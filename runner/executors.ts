import '../lib/studio-adapter/server-only';
import {realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {commandInput,authorizedProject} from '../lib/bridge/validation.server';
import type {BridgeCommand} from '../lib/bridge/types';
import {publicText} from '../lib/studio-adapter/cpe-source.server';
export interface ExecutorResult {ok:boolean;retryable:boolean;code:'MOCK_COMPLETED'|'MOCK_TRANSIENT_FAILURE'|'MOCK_PERMANENT_FAILURE'|'EXECUTION_UNCERTAIN';executionCount:number;}
export function validateJob(job:BridgeCommand){authorizedProject(job.project_id);return commandInput.parse({projectId:job.project_id,type:job.command_type,mode:job.mode,idempotencyKey:job.idempotency_key,payload:JSON.parse(job.payload)});}
/** No subprocess calls or CPE access exist in this executor. Failures are injected BEFORE synthetic work. */
export function mockExecute(job:BridgeCommand):ExecutorResult {
  const data=validateJob(job);
  if(data.payload.scenario==='always-fail')return {ok:false,retryable:true,code:'MOCK_TRANSIENT_FAILURE',executionCount:0};
  if(data.payload.scenario==='fail-once'&&job.attempt_count===1)return {ok:false,retryable:true,code:'MOCK_TRANSIENT_FAILURE',executionCount:0};
  return {ok:true,retryable:false,code:'MOCK_COMPLETED',executionCount:1};
}
export interface RealPlanInput {type:string;projectSlug:string;clientName?:string;expectedGate?:string;note?:string;}
/** Translation only. Source verified read-only; no engine logic copied. */
export function realCommandPlan(input:RealPlanInput,root:string) {
  if(!/^bridge-disposable-[a-z0-9-]+$/.test(input.projectSlug))throw Error('Only an explicitly disposable bridge project is permitted.');
  if(!root || !resolve(root).endsWith('/AI_COMMAND_CENTER-bridge'))throw Error('Separate bridge worktree required.');
  const slug=input.projectSlug;
  if(input.type==='CREATE_PROJECT')return {cwd:resolve(root),file:resolve(root,'command.sh'),args:['creative-studio','project','create','--client',input.clientName||slug,'--slug',slug]};
  if(input.type==='START_RUN'||input.type==='RESUME_RUN')return {cwd:resolve(root,'dashboard'),file:'npm',args:['run','creative-studio:orchestrator','--',input.type==='START_RUN'?'run':'run-resume','--project',slug]};
  if(input.type==='APPROVE_GATE')throw Error('Approval mapping verified, but expected-stage/run fencing is required before real execution: command.sh creative-studio approve --project <slug>.');
  throw Error('Command unsupported: safe cancellation/pause has not been verified.');
}
/** Exists for a future disposable test. Pass 1 queue accepts MOCK only; runner refuses REAL startup. */
export async function executeReal(input:RealPlanInput,root:string,explicitOptIn?:string):Promise<{exitCode:number|null;stdout:string;stderr:string}> {
  if(explicitOptIn!=='DISPOSABLE_PROJECT_ONLY')throw Error('Real execution is disabled.');
  const plan=realCommandPlan(input,root);
  if(realpathSync(root)!==resolve(root))throw Error("Bridge worktree cannot be a symlink.");
  return new Promise((resolveResult,reject)=>{
    const child=spawn(plan.file,plan.args,{cwd:plan.cwd,shell:false,stdio:['ignore','pipe','pipe'],timeout:120000});
    let stdout='',stderr='';child.stdout.on('data',b=>stdout=(stdout+b).slice(-8000));child.stderr.on('data',b=>stderr=(stderr+b).slice(-8000));
    child.on('error',()=>reject(Error('CPE process could not start.')));
    child.on('close',exitCode=>resolveResult({exitCode,stdout:publicText(stdout),stderr:publicText(stderr)}));
  });
}
