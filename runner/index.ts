import {classifyReconciliation,processIdentity} from './reconciliation';
import {parseEnv} from 'node:util';
import {FACTORY_ROOT,configuredProject} from './executors';
import {CpeFence} from '../lib/bridge/cpe-fence.server';
import {SupabaseReadSource} from '../lib/studio-adapter/cpe-source.server';
import {disposableArtifacts} from './artifacts';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {mockExecute,validateJob,type ExecutorResult} from './executors';
import {launchTask,taskState,supervisionDecision} from './supervision';
import type {BridgeCommand} from '../lib/bridge/types';
const config=JSON.parse(readFileSync(process.env.BRIDGE_CONFIG||resolve('.studio/runner.json'),'utf8'));
const mode=process.env.BRIDGE_EXECUTOR_MODE||config.mode||'MOCK';
process.env.BRIDGE_PROJECT_SLUG=config.realProject;
if(!['MOCK','REAL'].includes(mode)||(mode==='REAL'&&!config.realProject))throw Error('Explicit project authorization required.');
const origin=new URL(config.origin);if(origin.protocol!=='https:')throw Error('Runner requires HTTPS.');
if(!config.runnerToken||!config.siteToken)throw Error('Runner authentication is not configured.');
const journalPath=resolve(config.journal||'.studio/runner-journal.sqlite');mkdirSync(dirname(journalPath),{recursive:true});
const journal=new DatabaseSync(journalPath);journal.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS executions (id TEXT PRIMARY KEY,state TEXT NOT NULL,result TEXT,execution_count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS real_tasks (id TEXT PRIMARY KEY,execution_id TEXT UNIQUE NOT NULL,job TEXT NOT NULL,created_at TEXT NOT NULL,delivered INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS runner_mutex (id INTEGER PRIMARY KEY,pid INTEGER NOT NULL);`);
// Single polling owner on this Mac. Kernel liveness only guards the service lock; tasks are never replayed based on PID.
const owner=journal.prepare('SELECT pid FROM runner_mutex WHERE id=1').get() as {pid:number}|undefined;
if(owner){try{process.kill(owner.pid,0);throw Error('Another runner process is active.');}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;}}
journal.prepare('INSERT OR REPLACE INTO runner_mutex(id,pid) VALUES(1,?)').run(process.pid);
const tasks=resolve('.studio/real-tasks');mkdirSync(tasks,{recursive:true,mode:0o700});
let artifactPublished=false;let artifactChecked=0;
let stopping=false;process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
async function api(path:string,body:unknown){const r=await fetch(new URL('/api/bridge/runner/'+path,origin),{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.runnerToken,'OAI-Sites-Authorization':'Bearer '+config.siteToken},body:JSON.stringify(body)});if(!r.ok)throw Error('Bridge HTTP '+r.status);return r.json() as Promise<any>;}
const log=(event:string,fields:Record<string,unknown>={})=>console.log(JSON.stringify({at:new Date().toISOString(),event,...fields}));
async function heartbeat(online=true){await api('heartbeat',{online,mode});}
let beating=false;const timer=setInterval(()=>{if(!beating){beating=true;void heartbeat().catch(()=>log('heartbeat-unavailable')).finally(()=>{beating=false;});}},15000);
async function reconcile(){
 const rows=journal.prepare('SELECT * FROM real_tasks WHERE delivered=0').all() as {id:string;execution_id:string;job:string;created_at:string}[];
 for(const row of rows){
  const job=JSON.parse(row.job),state=taskState(tasks,row.id),decision=supervisionDecision(state,row.execution_id);
  let classification:'STILL_RUNNING'|'COMPLETED_SUCCESS'|'COMPLETED_FAILURE'|'SAFE_TO_RETRY'|'MANUAL_REVIEW_REQUIRED'='MANUAL_REVIEW_REQUIRED';
  try {
   const credentials=parseEnv(readFileSync(resolve(FACTORY_ROOT,'dashboard/.env.local'),'utf8'));
   const source=new SupabaseReadSource(credentials.NEXT_PUBLIC_SUPABASE_URL,credentials.SUPABASE_SERVICE_ROLE_KEY);
   const {run}=await new CpeFence(source,job.project_id).state();
   const events=run?await source.rows('creative_studio_production_run_events',{run_id:`eq.${run.id}`,select:'id,event_type,created_at',order:'created_at.desc',limit:'5'}):[];
   const payload=JSON.parse(job.payload);
   const command=await api(`commands/${row.id}/inspect`,{token:job.claim_token,executionId:row.execution_id});
   classification=classifyReconciliation({executionId:row.execution_id,receipt:state,processMatches:!!state?.processIdentity&&processIdentity(state?.processId)===state.processIdentity,authoritativeRunId:run?.id,expectedRunId:payload.runId,queueStatus:command.status,dispatchIntent:true,eventsObserved:events.length,authoritativeAvailable:true});
   await api(`commands/${row.id}/reconcile`,{token:job.claim_token,executionId:row.execution_id,classification});
  }catch{await api(`commands/${row.id}/reconcile`,{token:job.claim_token,executionId:row.execution_id,classification:'MANUAL_REVIEW_REQUIRED'}).catch(()=>{});}

  if(decision==='complete'&&['COMPLETED_SUCCESS','COMPLETED_FAILURE','SAFE_TO_RETRY'].includes(classification)){
   // Renew then finish; both are fenced by the original opaque claim and execution ID. Retry delivery, never execution.
   await api(`commands/${row.id}/progress`,{token:job.claim_token,executionId:row.execution_id,processId:state.processId||null});
   await api(`commands/${row.id}/finish`,{token:job.claim_token,...state.result});
   journal.prepare('UPDATE real_tasks SET delivered=1 WHERE id=?').run(row.id);
   journal.prepare("INSERT OR REPLACE INTO executions(id,state,result,execution_count) VALUES(?,'complete',?,?)").run(row.id,JSON.stringify(state.result),state.result.executionCount);log('real-result',{commandId:row.id,code:state.result.code});
  }else if(decision==='running'&&classification==='STILL_RUNNING')await api(`commands/${row.id}/progress`,{token:job.claim_token,executionId:row.execution_id,processId:state.processId||null});
  // Missing/stale supervisor evidence intentionally leaves RUNNING durable and blocks further real dispatch.
 }
 return rows.length>0;
}
log('runner-started',{runnerId:config.runnerId,mode});
try{await heartbeat();while(!stopping){try{
 if(mode==='REAL'&&!artifactPublished&&Date.now()-artifactChecked>30000){artifactChecked=Date.now();try{const artifacts=await disposableArtifacts(configuredProject());for(const artifact of artifacts){const published=await api('artifacts',artifact);log('artifact-published',{sourceArtifactId:artifact.sourceArtifactId,objectId:published.id,representation:artifact.representation});}artifactPublished=artifacts.length>0;}catch{log('artifact-not-ready');}}
 const active=await reconcile();const job=await api('claim',{mode:active?'MOCK':mode}) as (BridgeCommand&{claim_token:string})|null;
 if(!job){await delay(2000);continue;}const input=validateJob(job);
 await api(`commands/${job.id}/start`,{token:job.claim_token});
 if(input.mode==='REAL'){
  if(mode!=='REAL')throw Error('REAL dispatch not authorized.');
  const prior=journal.prepare('SELECT id FROM real_tasks WHERE id=?').get(job.id);
  if(prior)throw Error('Execution already journaled.');
  const executionId=crypto.randomUUID();journal.prepare('INSERT INTO real_tasks(id,execution_id,job,created_at) VALUES(?,?,?,?)').run(job.id,executionId,JSON.stringify(job),new Date().toISOString());
  await api(`commands/${job.id}/progress`,{token:job.claim_token,executionId});
  launchTask(job,executionId,tasks);log('real-dispatched',{commandId:job.id,executionId});continue;
 }
 const previous=journal.prepare('SELECT * FROM executions WHERE id=?').get(job.id) as {state:string;result:string}|undefined;
 let result:ExecutorResult;
 if(previous?.state==='complete')result=JSON.parse(previous.result);
 else if(previous?.state==='executing')result={ok:false,retryable:false,code:'EXECUTION_UNCERTAIN',executionCount:0};
 else{journal.prepare("INSERT INTO executions(id,state) VALUES(?,'executing') ON CONFLICT(id) DO UPDATE SET state='executing'").run(job.id);result=mockExecute(job);journal.prepare('UPDATE executions SET state=?,result=?,execution_count=execution_count+? WHERE id=?').run(result.ok?'complete':result.retryable?'retryable':'complete',JSON.stringify(result),result.executionCount,job.id);}
 let delivered=false;for(let retry=0;retry<3&&!delivered;retry++){try{await api(`commands/${job.id}/finish`,{token:job.claim_token,...result});delivered=true;}catch{await delay(1000);}}
 log('command-result',{commandId:job.id,attempt:job.attempt_count,code:result.code,delivered});
 }catch{log('poll-unavailable');await delay(4000);}}}
finally{clearInterval(timer);await heartbeat(false).catch(()=>{});journal.prepare('DELETE FROM runner_mutex WHERE id=1 AND pid=?').run(process.pid);journal.close();log('runner-stopped');}
