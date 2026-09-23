import '../lib/studio-adapter/server-only';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {commandInput,authorizedProject,REAL_PROJECT,type ExecutorResult} from '../lib/bridge/validation.server';
import type {BridgeCommand} from '../lib/bridge/types';
export type {ExecutorResult};
export const FACTORY_ROOT=resolve(homedir(),'AI_COMMAND_CENTER-bridge');
export const configuredProject=()=>process.env.BRIDGE_PROJECT_SLUG||REAL_PROJECT;
export function validateJob(job:BridgeCommand){authorizedProject(job.project_id,job.mode,configuredProject());return commandInput.parse({projectId:job.project_id,type:job.command_type,mode:job.mode,idempotencyKey:job.idempotency_key,payload:JSON.parse(job.payload)});}
export function mockExecute(job:BridgeCommand):ExecutorResult {
 const data=validateJob(job);if(data.mode!=='MOCK')throw Error('Mock executor refuses REAL jobs.');
 if(data.payload.scenario==='always-fail'||(data.payload.scenario==='fail-once'&&job.attempt_count===1))return {ok:false,retryable:true,code:'MOCK_TRANSIENT_FAILURE',executionCount:0};
 return {ok:true,retryable:false,code:'MOCK_COMPLETED',executionCount:1};
}
export interface RealPlanInput {type:string;projectSlug:string;clientName?:string;expectedGate?:string;note?:string;runId?:string;approvedBy?:string;definition?:{intake:Record<string,unknown>;implementation:unknown};}
export function realCommandPlan(input:RealPlanInput,root:string) {
 authorizedProject(input.projectSlug,'REAL',configuredProject());
 if(resolve(root)!==FACTORY_ROOT)throw Error('Exact separate bridge worktree required.');
 if(input.type==='CREATE_PROJECT'){
  if(!input.definition?.implementation||!input.definition.intake)throw Error('Complete local production definition required before project creation.');
  return {cwd:root,file:resolve(root,'command.sh'),args:['creative-studio','project','create','--client',String(input.definition.intake.organization||input.projectSlug),'--slug',input.projectSlug,'--goal','Execute the authorized production definition.','--description',JSON.stringify(input.definition.intake)]};
 }
 if(input.type==='START_RUN'||input.type==='RESUME_RUN')return {cwd:resolve(root,'dashboard'),file:process.execPath,args:[resolve(root,'dashboard/node_modules/tsx/dist/cli.mjs'),'--conditions=react-server',resolve(root,'dashboard/scripts/creative-studio-orchestrator.ts'),input.type==='START_RUN'?'run':'run-resume','--project',input.projectSlug,'--mode','CLEAN_ROOM','--allow-sources',input.projectSlug,'--build-target','next-project']};
 if(input.type==='APPROVE_GATE'&&['AWAITING_DIRECTION_APPROVAL','AWAITING_BUILD_APPROVAL','AWAITING_FINAL_APPROVAL'].includes(input.expectedGate||'')&&/^[a-f0-9-]{36}$/.test(input.runId||'')&&input.approvedBy)return {cwd:root,file:resolve(root,'command.sh'),args:['creative-studio','approve','--project',input.projectSlug,'--run-id',input.runId!,'--expected-stage',input.expectedGate!,'--approval-type',input.expectedGate!,'--approved-by',input.approvedBy]};
 throw Error('Command unsupported or approval fence missing.');
}
/** Direct execution is deliberately unavailable: only the journaled supervisor may launch. */
export async function executeReal(_input:RealPlanInput,_root:string):Promise<never>{throw Error('Direct real execution disabled. Use the durable runner supervisor.');}
