export type CommandType = 'CREATE_PROJECT'|'START_RUN'|'RESUME_RUN'|'APPROVE_GATE';
export type CommandStatus = 'QUEUED'|'CLAIMED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';
export interface BridgeCommand {
  id:string; project_id:string; command_type:CommandType; mode:'MOCK'|'REAL'; payload:string;
  requested_by:string; idempotency_key:string; created_at:string; status:CommandStatus;
  claimed_by:string|null; claimed_at:string|null; attempt_count:number; acknowledgment:string|null;
  result:string|null; error:string|null; completed_at:string|null; available_at:string;
  history:string; reconciliation?:string|null;reconciled_at?:string|null; execution_id?:string|null; process_id?:number|null; progress_at?:string|null;
}
export interface FactoryPresence {runnerId:string;mode:'MOCK'|'REAL';online:boolean;lastSeen:string;staleAfterSeconds:number;}
export interface BridgeSnapshot {runner:FactoryPresence|null;commands:BridgeCommand[];canSubmit:boolean;mode:'MOCK'|'REAL';real?:{studioEnabled?:boolean;projectSlug:string;allowed:string[];proven:string[];capabilities?:{canCreateProject:boolean;canStartRun:boolean;canResumeRun:boolean;canApprove:boolean;canPauseRun:false;canCancelRun:false};projectId?:string;runId?:string;stage?:string;runStatus?:string;gate?:string|null;};artifacts?:{id:string;sourceArtifactId:string;representation?:string;thumbnailUrl?:string;mimeType:string;bytes:number;sha256:string;previewUrl:string;downloadUrl:string}[];}
