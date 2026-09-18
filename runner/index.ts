import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {mockExecute,validateJob,type ExecutorResult} from './executors';
import type {BridgeCommand} from '../lib/bridge/types';
const config=JSON.parse(readFileSync(process.env.BRIDGE_CONFIG||resolve('.studio/runner.json'),'utf8'));
const mode=process.env.BRIDGE_EXECUTOR_MODE||config.mode||'MOCK';
if(mode!=='MOCK')throw Error('Pass 1 runner only permits MOCK. Real plans are prepared separately for review.');
const origin=new URL(config.origin);if(origin.protocol!=='https:')throw Error('Runner requires HTTPS.');
if(!config.runnerToken||!config.siteToken)throw Error('Runner authentication is not configured.');
const journalPath=resolve(config.journal||'.studio/runner-journal.sqlite');mkdirSync(dirname(journalPath),{recursive:true});
const journal=new DatabaseSync(journalPath);journal.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS executions (id TEXT PRIMARY KEY, state TEXT NOT NULL, result TEXT, execution_count INTEGER NOT NULL DEFAULT 0)');
let stopping=false;
process.on('SIGTERM',()=>{stopping=true;});process.on('SIGINT',()=>{stopping=true;});
async function api(path:string,body:unknown){const r=await fetch(new URL('/api/bridge/runner/'+path,origin),{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.runnerToken,'OAI-Sites-Authorization':'Bearer '+config.siteToken},body:JSON.stringify(body)});if(!r.ok)throw Error('Bridge HTTP '+r.status);return r.json() as Promise<any>;}
const log=(event:string,fields:Record<string,unknown>={})=>console.log(JSON.stringify({at:new Date().toISOString(),event,...fields}));
async function heartbeat(online=true){await api('heartbeat',{online,mode:'MOCK'});}
let beating=false;
const timer=setInterval(()=>{if(!beating){beating=true;void heartbeat().catch(()=>log('heartbeat-unavailable')).finally(()=>{beating=false;});}},15000);
log('runner-started',{runnerId:config.runnerId,mode});
try {
  await heartbeat();
  while(!stopping){
    try {
      const job=await api('claim',{}) as (BridgeCommand&{claim_token:string})|null;
      if(!job){await delay(2000);continue;}
      validateJob(job);
      await api(`commands/${job.id}/start`,{token:job.claim_token});
      const previous=journal.prepare('SELECT * FROM executions WHERE id=?').get(job.id) as {state:string;result:string}|undefined;
      let result:ExecutorResult;
      if(previous?.state==='complete')result=JSON.parse(previous.result);
      else if(previous?.state==='executing')result={ok:false,retryable:false,code:'EXECUTION_UNCERTAIN',executionCount:0};
      else {
        journal.prepare("INSERT INTO executions (id,state) VALUES (?,'executing') ON CONFLICT(id) DO UPDATE SET state='executing'").run(job.id);
        result=mockExecute(job);
        journal.prepare('UPDATE executions SET state=?,result=?,execution_count=execution_count+? WHERE id=?').run(result.ok?'complete':result.retryable?'retryable':'complete',JSON.stringify(result),result.executionCount,job.id);
      }
      let delivered=false;
      for(let retry=0;retry<3&&!delivered;retry++){try{await api(`commands/${job.id}/finish`,{token:job.claim_token,...result});delivered=true;}catch{await delay(1000);}}
      log('command-result',{commandId:job.id,attempt:job.attempt_count,code:result.code,delivered});
    }catch{log('poll-unavailable');await delay(4000);}
  }
}finally{clearInterval(timer);await heartbeat(false).catch(()=>{});journal.close();log('runner-stopped');}
