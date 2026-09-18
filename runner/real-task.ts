/** Detached, one-command supervisor. Never accepts an executable, cwd or shell string from a job. */
import {readFileSync,writeFileSync,renameSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseEnv} from 'node:util';
import {spawn} from 'node:child_process';
import {validateJob,realCommandPlan,FACTORY_ROOT,type ExecutorResult} from './executors';
import {CpeFence} from '../lib/bridge/cpe-fence.server';
import {SupabaseReadSource,publicText} from '../lib/studio-adapter/cpe-source.server';
const taskFile=resolve(process.argv[2]);
const task=JSON.parse(readFileSync(taskFile,'utf8'));
const data=validateJob(task.job);if(data.mode!=='REAL')throw Error('REAL task required.');
if(realpathSync(FACTORY_ROOT)!==FACTORY_ROOT)throw Error('Factory worktree cannot be a symlink.');
const credentials=parseEnv(readFileSync(resolve(FACTORY_ROOT,'dashboard/.env.local'),'utf8'));
for(const k of ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','CREATIVE_STUDIO_AGENT_PROVIDER'])if(credentials[k])process.env[k]=credentials[k];
const source=new SupabaseReadSource(credentials.NEXT_PUBLIC_SUPABASE_URL,credentials.SUPABASE_SERVICE_ROLE_KEY);
const fence=new CpeFence(source);
let processId:number|undefined,executionCount=0,stdout='',stderr='';
const stateFile=resolve(dirname(taskFile),'state.json');
const atomic=(value:unknown)=>{writeFileSync(stateFile+'.tmp',JSON.stringify(value),{mode:0o600});renameSync(stateFile+'.tmp',stateFile);};
const safe=(v:string)=>{for(const value of Object.values(credentials))if(value&&value.length>15)v=v.replaceAll(value,'[credential]');return publicText(v).slice(-4000);};
const tick=()=>atomic({executionId:task.executionId,supervisorPid:process.pid,processId,progressAt:new Date().toISOString(),state:'running'});
let result:ExecutorResult;let lock:any,lockedRun:string|undefined,leaseTimer:NodeJS.Timeout|undefined;
const timer=setInterval(tick,5000);tick();
try{
 const before=await fence.validate(data);
 if(data.type==='CREATE_PROJECT'&&before.project){result={ok:true,retryable:false,code:'REAL_COMPLETED',executionCount:1,projectId:before.project.id,stdout:'Existing authoritative disposable project verified; no create executed.'};}
 else {
  if(data.type==='APPROVE_GATE'){
   lock=await import(pathToFileURL(resolve(FACTORY_ROOT,'dashboard/lib/creative-studio/orchestrator/dataAccess.ts')).href);
   const held=await lock.acquireRunLock(before.run.id,task.executionId);if(!held.ok)throw Error('CPE run lock unavailable.');lockedRun=before.run.id;
   leaseTimer=setInterval(()=>{void lock.renewRunLock(lockedRun,task.executionId).catch(()=>{});},15000);
   await fence.validate(data,task.executionId);
  }
  const plan=realCommandPlan({type:data.type,projectSlug:data.projectId,expectedGate:data.type==='APPROVE_GATE'?data.payload.gate:undefined},FACTORY_ROOT);
  const exitCode=await new Promise<number|null>((done,reject)=>{
   const child=spawn(plan.file,plan.args,{cwd:plan.cwd,shell:false,stdio:['ignore','pipe','pipe'],env:{PATH:process.env.PATH,HOME:process.env.HOME,USER:process.env.USER,LANG:process.env.LANG,TMPDIR:process.env.TMPDIR,NEXT_PUBLIC_SUPABASE_URL:credentials.NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:credentials.SUPABASE_SERVICE_ROLE_KEY,CREATIVE_STUDIO_AGENT_PROVIDER:'codex'}});
   processId=child.pid;child.once('spawn',()=>{executionCount=1;tick();});
   child.stdout.on('data',b=>{stdout=(stdout+b).slice(-8000);});child.stderr.on('data',b=>{stderr=(stderr+b).slice(-8000);});
   child.once('error',()=>reject(Error('CPE process could not start.')));child.once('close',done);
  });
  const after=await fence.state();
  let verified=exitCode===0;
  if(data.type==='CREATE_PROJECT')verified&&=!!after.project;
  else if(data.type==='APPROVE_GATE'){
   const approvals=await source.rows('approvals',{action_type:`eq.creative-studio:${data.payload.gate}:${data.projectId}`,select:'id',limit:'2'});
   verified&&=after.project?.current_stage==='EXPERIENCE_DESIGN'&&approvals.length===1;
  }else verified&&=!!after.run;
  result={ok:verified,retryable:false,code:verified?'REAL_COMPLETED':'REAL_FAILED',executionCount,stdout:safe(stdout),stderr:safe(stderr),projectId:after.project?.id,runId:after.run?.id};
 }
}catch{result={ok:false,retryable:false,code:executionCount?'REAL_FAILED':'FENCE_REJECTED',executionCount,stdout:safe(stdout),stderr:'Authoritative fence or CPE execution failed. Inspect private runner evidence.'};}
finally{clearInterval(timer);if(leaseTimer)clearInterval(leaseTimer);if(lockedRun)await lock.releaseRunLock(lockedRun,task.executionId).catch(()=>{});}
atomic({executionId:task.executionId,supervisorPid:process.pid,processId,progressAt:new Date().toISOString(),state:'complete',result:{...result!,executionId:task.executionId,processId}});
