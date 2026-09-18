import {authorizeRealProject,type ProjectAuthorization} from './project-authorization.server';
import '../studio-adapter/server-only';
import {SupabaseReadSource,type ReadSource} from '../studio-adapter/cpe-source.server';
import {REAL_PROJECT,type CommandInput} from './validation.server';
import {StudioError} from '../studio-adapter/errors';
export class CpeFence {
 constructor(readonly source:ReadSource){}
 async state(){const projects=await this.source.rows('creative_studio_projects',{slug:`eq.${REAL_PROJECT}`,select:'id,slug,current_stage,status',limit:'2'});if(projects.length>1)throw new StudioError('Disposable identity is not unique.',409);const project=projects[0];const runs=project?await this.source.rows('creative_studio_production_runs',{project_id:`eq.${project.id}`,select:'id,project_id,mode,status,current_stage,human_gate,lock_holder,lock_expires_at',order:'run_number.desc',limit:'1'}):[];return {project,run:runs[0]};}
 async authorize(){const state=await this.state();const entries=await this.source.rows('studio_project_authorizations',{slug:`eq.${REAL_PROJECT}`,select:'project_id,slug,enabled,historically_denied,clean_room_required',limit:'1'});authorizeRealProject(REAL_PROJECT,state.project?.id,entries[0] as ProjectAuthorization|undefined,state.run?.mode);return state;}
 async validate(d:CommandInput,lockHolder?:string){
  if(d.mode!=='REAL'||d.projectId!==REAL_PROJECT)throw new StudioError('Real project is not authorized.',403);
  const state=await this.authorize(),{project,run}=state;
  if(d.type==='CREATE_PROJECT')return state;
  if(!project||project.status==='archived')throw new StudioError('Active disposable project required.',409);
  if(run?.lock_holder&&run.lock_holder!==lockHolder&&Date.parse(run.lock_expires_at)>Date.now())throw new StudioError('CPE run is already locked.',409);
  if(d.type==='START_RUN'){if(run)throw new StudioError('Disposable project already has a run. START cannot replay.',409);return state;}
  if(!run||run.id!==d.payload.runId||project.current_stage!==d.payload.expectedStage)throw new StudioError('Stale production run or project stage.',409);
  if(d.type==='APPROVE_GATE'){
   if(d.payload.gate!==d.payload.expectedStage||d.payload.approvalType!==d.payload.gate||run.current_stage!==d.payload.gate||run.human_gate!==d.payload.gate||run.status!=='AWAITING_HUMAN_APPROVAL')throw new StudioError('Requested approval does not match the pending CPE gate.',409);
   const prior=await this.source.rows('approvals',{action_type:`eq.creative-studio:${d.payload.gate}:${REAL_PROJECT}`,select:'id',limit:'1'});if(prior.length)throw new StudioError('Gate already approved.',409);
  }else if(run.status!=='AWAITING_HUMAN_APPROVAL'||project.current_stage===run.current_stage||!['EXPERIENCE_DESIGN','IMPLEMENTATION','COMPLETE'].includes(project.current_stage))throw new StudioError('Resume requires an approved gate on this run.',409);
  return state;
 }
}
export const cpeFence=(env:{DEVLAB_SUPABASE_URL?:string;DEVLAB_SUPABASE_SERVICE_ROLE_KEY?:string;DEVLAB_READ_TOKEN?:string})=>new CpeFence(new SupabaseReadSource(env.DEVLAB_SUPABASE_URL,env.DEVLAB_SUPABASE_SERVICE_ROLE_KEY,undefined,env.DEVLAB_READ_TOKEN));
