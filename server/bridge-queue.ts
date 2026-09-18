import '../lib/studio-adapter/server-only';
import type { D1Database } from '@cloudflare/workers-types';
import { StudioError } from '../lib/studio-adapter/errors';
import { commandInput,authorizedProject,SYNTHETIC_PROJECT,REAL_PROJECT,semanticKey,type ExecutorResult } from '../lib/bridge/validation.server';
import type { BridgeCommand } from '../lib/bridge/types';
type Job=BridgeCommand & {claim_token:string;lease_until:string;fingerprint:string};
import {publicText} from '../lib/studio-adapter/cpe-source.server';
const visible=(job:Job)=>{const {claim_token,lease_until,fingerprint,...view}=job;return view;};
export class BridgeQueue {
  constructor(private db:D1Database,private now=()=>new Date().toISOString()){}
  async submit(input:unknown,actor:string){
    const data=commandInput.parse(input);authorizedProject(data.projectId,data.mode);
    const fingerprint=JSON.stringify([data.projectId,data.type,data.mode,data.payload]);const now=this.now();
    await this.db.prepare(`INSERT OR IGNORE INTO bridge_commands (id,project_id,command_type,mode,payload,requested_by,idempotency_key,fingerprint,created_at,status,attempt_count,available_at,history,semantic_key) VALUES (?,?,?,?,?,?,?,?,?,'QUEUED',0,?,?,?)`).bind(crypto.randomUUID(),data.projectId,data.type,data.mode,JSON.stringify(data.payload),actor,data.idempotencyKey,fingerprint,now,now,JSON.stringify([{status:'QUEUED',at:now}]),semanticKey(data)).run();
    const job=await this.db.prepare('SELECT * FROM bridge_commands WHERE (requested_by=? AND idempotency_key=?) OR (semantic_key IS NOT NULL AND semantic_key=?) ORDER BY created_at LIMIT 1').bind(actor,data.idempotencyKey,semanticKey(data)).first<Job>();
    if(!job)throw new StudioError('Command could not be stored.',503);
    if(job.fingerprint!==fingerprint)throw new StudioError('Idempotency key was already used with different content.',409);
    return visible(job);
  }
  async cancelQueued(id:string){const now=this.now();const job=await this.db.prepare("UPDATE bridge_commands SET status='CANCELLED',completed_at=?,history=json_insert(history,'$[#]',json_object('status','CANCELLED','at',?)) WHERE id=? AND status='QUEUED' RETURNING *").bind(now,now,id).first<Job>();if(!job)throw new StudioError('Only an unclaimed queued transport job can be cancelled.',409);return visible(job);}
  async list(){const r=await this.db.prepare('SELECT * FROM bridge_commands ORDER BY created_at DESC LIMIT 30').all<Job>();return r.results.map(visible);}
  async heartbeat(runner:string,online=true,mode:'MOCK'|'REAL'='MOCK'){const now=this.now();await this.db.prepare(`INSERT INTO bridge_runners (id,last_seen,mode,online) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen,mode=excluded.mode,online=excluded.online`).bind(runner,now,mode,online?1:0).run();return {lastSeen:now};}
  async presence(runner:string){const r=await this.db.prepare('SELECT * FROM bridge_runners WHERE id=?').bind(runner).first<{id:string;last_seen:string;mode:'MOCK'|'REAL';online:number}>();return r?{runnerId:r.id,mode:r.mode,lastSeen:r.last_seen,online:r.online===1&&Date.parse(this.now())-Date.parse(r.last_seen)<45000,staleAfterSeconds:45}:null;}
  async claim(runner:string,mode:'MOCK'|'REAL'='MOCK'){
    const now=this.now(),until=new Date(Date.parse(now)+60000).toISOString();
    // Uncertain RUNNING work is never replayed. CLAIMED work cannot execute without a successful fenced start.
    await this.db.prepare(`UPDATE bridge_commands SET status='FAILED',error='Lease expired after execution started; manual review required.',completed_at=?,history=json_insert(history,'$[#]',json_object('status','FAILED','at',?)) WHERE status='RUNNING' AND mode='MOCK' AND lease_until<?`).bind(now,now,now).run();
    await this.db.prepare(`UPDATE bridge_commands SET status=CASE WHEN attempt_count<3 THEN 'QUEUED' ELSE 'FAILED' END,error='Claim lease expired',completed_at=CASE WHEN attempt_count>=3 THEN ? ELSE NULL END,claim_token=NULL,claimed_by=NULL,available_at=?,history=json_insert(history,'$[#]',json_object('status',CASE WHEN attempt_count<3 THEN 'QUEUED' ELSE 'FAILED' END,'at',?)) WHERE status='CLAIMED' AND lease_until<?`).bind(now,now,now,now).run();
    return this.db.prepare(`UPDATE bridge_commands SET status='CLAIMED',claimed_by=?,claimed_at=?,claim_token=?,lease_until=?,attempt_count=attempt_count+1,history=json_insert(history,'$[#]',json_object('status','CLAIMED','at',?)) WHERE id=(SELECT id FROM bridge_commands WHERE status='QUEUED' AND ((mode='MOCK' AND project_id=?) OR (mode='REAL' AND project_id=? AND ?='REAL' AND NOT EXISTS (SELECT 1 FROM bridge_commands active WHERE active.mode='REAL' AND active.status IN ('CLAIMED','RUNNING')))) AND available_at<=? AND attempt_count<3 ORDER BY created_at LIMIT 1) AND status='QUEUED' RETURNING *`).bind(runner,now,crypto.randomUUID(),until,now,SYNTHETIC_PROJECT,REAL_PROJECT,mode,now).first<Job>();
  }
  async start(id:string,token:string,runner:string){const now=this.now();const job=await this.db.prepare(`UPDATE bridge_commands SET status='RUNNING',acknowledgment=?,history=json_insert(history,'$[#]',json_object('status','RUNNING','at',?)) WHERE id=? AND claim_token=? AND claimed_by=? AND status='CLAIMED' AND lease_until>? RETURNING *`).bind(now,now,id,token,runner,now).first<Job>();if(!job)throw new StudioError('Claim is stale or already acknowledged.',409);return visible(job);}
  async progress(id:string,token:string,runner:string,executionId:string,processId:number|null=null){
    const completed=await this.db.prepare("SELECT * FROM bridge_commands WHERE id=? AND claim_token=? AND claimed_by=? AND execution_id=? AND status IN ('SUCCEEDED','FAILED')").bind(id,token,runner,executionId).first<Job>();if(completed)return visible(completed);
    const now=this.now(),until=new Date(Date.parse(now)+60000).toISOString();
    const job=await this.db.prepare(`UPDATE bridge_commands SET progress_at=?,lease_until=?,execution_id=?,process_id=COALESCE(?,process_id) WHERE id=? AND claim_token=? AND claimed_by=? AND status='RUNNING' AND mode='REAL' AND (execution_id IS NULL OR execution_id=?) RETURNING *`).bind(now,until,executionId,processId,id,token,runner,executionId).first<Job>();
    if(!job)throw new StudioError('Execution identity is stale.',409);return visible(job);
  }
  async finish(id:string,token:string,runner:string,outcome:ExecutorResult){
    const job=await this.db.prepare('SELECT * FROM bridge_commands WHERE id=? AND claim_token=? AND claimed_by=?').bind(id,token,runner).first<Job>();
    if(!job)throw new StudioError('Command claim not found.',409);
    if(['SUCCEEDED','FAILED'].includes(job.status))return visible(job);
    if(job.status!=='RUNNING'||(job.mode==='MOCK'&&job.lease_until<=this.now()))throw new StudioError('Command is not running under this lease.',409);
    if(job.mode==='MOCK'&&outcome.code.startsWith('REAL_'))throw new StudioError('Executor mode mismatch.',409);
    if(job.mode==='REAL'&&(!outcome.executionId||job.execution_id!==outcome.executionId||outcome.retryable))throw new StudioError('Real execution identity mismatch.',409);
    const retry=job.mode==='MOCK'&&!outcome.ok&&outcome.retryable&&outcome.code==='MOCK_TRANSIENT_FAILURE'&&outcome.executionCount===0&&job.attempt_count<3;
    const state=outcome.ok?'SUCCEEDED':retry?'QUEUED':'FAILED',now=this.now();
    const result=JSON.stringify({...outcome,mode:job.mode,cpeInvoked:job.mode==='REAL'&&outcome.executionCount===1,stdout:publicText(outcome.stdout||(job.mode==='MOCK'&&outcome.ok?'Synthetic command completed; no CPE invocation.':'')),stderr:publicText(outcome.stderr||(!outcome.ok?outcome.code:''))});
    const updated=await this.db.prepare(`UPDATE bridge_commands SET status=?,result=?,error=?,completed_at=?,available_at=?,history=json_insert(history,'$[#]',json_object('status',?,'at',?)) WHERE id=? AND claim_token=? AND status='RUNNING' RETURNING *`).bind(state,result,outcome.ok?null:outcome.code,retry?null:now,new Date(Date.parse(now)+(retry?2000:0)).toISOString(),state,now,id,token).first<Job>();
    if(!updated)throw new StudioError('Command changed concurrently.',409);return visible(updated);
  }
}
