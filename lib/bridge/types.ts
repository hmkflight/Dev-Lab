export type CommandType = 'CREATE_PROJECT'|'START_RUN'|'RESUME_RUN'|'APPROVE_GATE';
export type CommandStatus = 'QUEUED'|'CLAIMED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'CANCELLED';
export interface BridgeCommand {
  id:string; project_id:string; command_type:CommandType; mode:'MOCK'; payload:string;
  requested_by:string; idempotency_key:string; created_at:string; status:CommandStatus;
  claimed_by:string|null; claimed_at:string|null; attempt_count:number; acknowledgment:string|null;
  result:string|null; error:string|null; completed_at:string|null; available_at:string;
  history:string;
}
export interface FactoryPresence {runnerId:string;mode:'MOCK'|'REAL';online:boolean;lastSeen:string;staleAfterSeconds:number;}
export interface BridgeSnapshot {runner:FactoryPresence|null;commands:BridgeCommand[];canSubmit:boolean;mode:'MOCK';}
