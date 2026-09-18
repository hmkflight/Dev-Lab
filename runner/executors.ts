import '../lib/studio-adapter/server-only';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {commandInput,authorizedProject,REAL_PROJECT,type ExecutorResult} from '../lib/bridge/validation.server';
import type {BridgeCommand} from '../lib/bridge/types';
export type {ExecutorResult};
export const FACTORY_ROOT=resolve(homedir(),'AI_COMMAND_CENTER-bridge');
export function validateJob(job:BridgeCommand){authorizedProject(job.project_id,job.mode);return commandInput.parse({projectId:job.project_id,type:job.command_type,mode:job.mode,idempotencyKey:job.idempotency_key,payload:JSON.parse(job.payload)});}
export function mockExecute(job:BridgeCommand):ExecutorResult {
 const data=validateJob(job);if(data.mode!=='MOCK')throw Error('Mock executor refuses REAL jobs.');
 if(data.payload.scenario==='always-fail'||(data.payload.scenario==='fail-once'&&job.attempt_count===1))return {ok:false,retryable:true,code:'MOCK_TRANSIENT_FAILURE',executionCount:0};
 return {ok:true,retryable:false,code:'MOCK_COMPLETED',executionCount:1};
}
export interface RealPlanInput {type:string;projectSlug:string;clientName?:string;expectedGate?:string;note?:string;}
export function realCommandPlan(input:RealPlanInput,root:string) {
 if(input.projectSlug!==REAL_PROJECT)throw Error('Only bridge-disposable-pass2 is authorized.');
 if(resolve(root)!==FACTORY_ROOT)throw Error('Exact separate bridge worktree required.');
 if(input.type==='CREATE_PROJECT')return {cwd:root,file:resolve(root,'command.sh'),args:['creative-studio','project','create','--client','Bridge Disposable Pass 2','--slug',REAL_PROJECT,'--goal','Verify the Studio bridge on a disposable, non-sensitive project.','--description','A fictional public one-page website for a community reading room named Lantern Room. Audience: adult readers. Primary action: learn opening hours. Use invented public-facing copy only. No forms, payments, accounts, integrations, external assets, client data or backend. Three distinct creative concepts; select the strongest viable direction at review. This is a disposable integration acceptance project.']};
 if(input.type==='START_RUN'||input.type==='RESUME_RUN')return {cwd:resolve(root,'dashboard'),file:process.execPath,args:[resolve(root,'dashboard/node_modules/tsx/dist/cli.mjs'),'--conditions=react-server',resolve(root,'dashboard/scripts/creative-studio-orchestrator.ts'),input.type==='START_RUN'?'run':'run-resume','--project',REAL_PROJECT,'--mode','CLEAN_ROOM','--allow-sources',REAL_PROJECT,'--build-target','static-single-file']};
 if(input.type==='APPROVE_GATE'&&input.expectedGate==='AWAITING_DIRECTION_APPROVAL')return {cwd:root,file:resolve(root,'command.sh'),args:['creative-studio','approve','--project',REAL_PROJECT,'--note','Hudson authorized disposable Pass 2 direction approval through the fenced Studio bridge.']};
 throw Error('Command unsupported or approval fence missing.');
}
/** Direct execution is deliberately unavailable: only the journaled supervisor may launch. */
export async function executeReal(_input:RealPlanInput,_root:string):Promise<never>{throw Error('Direct real execution disabled. Use the durable runner supervisor.');}
