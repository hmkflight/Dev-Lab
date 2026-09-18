import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const reconciliationStates=['STILL_RUNNING','COMPLETED_SUCCESS','COMPLETED_FAILURE','SAFE_TO_RETRY','MANUAL_REVIEW_REQUIRED'] as const;
export type ReconciliationState=typeof reconciliationStates[number];
/** PID plus kernel start time and fixed command identity. No signals or shell invocation. */
export function processIdentity(pid:number|undefined):string|null {
 if(!pid||!Number.isSafeInteger(pid)||pid<1)return null;
 try {const value=execFileSync('/bin/ps',['-p',String(pid),'-o','pid=,lstart=,command='],{encoding:'utf8',timeout:2000,maxBuffer:16384}).trim();return value?createHash('sha256').update(value).digest('hex'):null;}catch{return null;}
}
export interface ReconciliationEvidence {
 executionId:string;receipt:any;processMatches:boolean;authoritativeRunId?:string;expectedRunId?:string;
 queueStatus:string;dispatchIntent:boolean;eventsObserved:number;authoritativeAvailable:boolean;
}
export function classifyReconciliation(e:ReconciliationEvidence):ReconciliationState {
 if(!e.authoritativeAvailable)return 'MANUAL_REVIEW_REQUIRED';
 if(e.expectedRunId&&e.authoritativeRunId!==e.expectedRunId)return 'MANUAL_REVIEW_REQUIRED';
 const r=e.receipt;
 if(!r){return !e.dispatchIntent&&['QUEUED','CLAIMED'].includes(e.queueStatus)?'SAFE_TO_RETRY':'MANUAL_REVIEW_REQUIRED';}
 if(r.executionId!==e.executionId)return 'MANUAL_REVIEW_REQUIRED';
 if(r.state==='complete'&&r.result?.executionId===e.executionId){
  if(e.processMatches)return 'MANUAL_REVIEW_REQUIRED';
  if(r.result.executionCount===0&&r.result.code==='FENCE_REJECTED')return 'SAFE_TO_RETRY';
  if(r.result.executionCount!==1)return 'MANUAL_REVIEW_REQUIRED';
  if(r.result.runId&&r.result.runId!==e.authoritativeRunId)return 'MANUAL_REVIEW_REQUIRED';
  return r.result.ok&&r.result.code==='REAL_COMPLETED'?'COMPLETED_SUCCESS':!r.result.ok?'COMPLETED_FAILURE':'MANUAL_REVIEW_REQUIRED';
 }
 if(r.state==='running'&&e.processMatches&&e.queueStatus==='RUNNING')return 'STILL_RUNNING';
 return 'MANUAL_REVIEW_REQUIRED';
}
