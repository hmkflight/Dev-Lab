import './server-only';
import type { StudioAdapter, StudioProject, StudioStage, ProjectDetail, StudioReview, StudioApproval, StudioCapabilities } from './types';
import { unavailableCapabilities } from './capabilities';
import { StudioError, DevLabAdapterNotConfiguredError } from './errors';
import { emptyContext } from './defaults';
import { SupabaseReadSource, publicText as text, type ReadSource, type Row } from './cpe-source.server';
export interface DevLabConfig {
  DEVLAB_ROOT?: string; DEVLAB_API_URL?: string; DEVLAB_SUPABASE_URL?: string; DEVLAB_SUPABASE_SERVICE_ROLE_KEY?: string;
  DEVLAB_ADAPTER_MODE?: string; DEVLAB_READ_PROJECT_SLUGS?: string;
}
const status = (r:Row|undefined,p:Row) => p.status==='archived'?'complete':p.status==='paused'?'paused':({RUNNING:'working',SOFTWARE_FACTORY_ACTIVE:'working',AWAITING_HUMAN_APPROVAL:'waiting',AWAITING_FINAL_APPROVAL:'waiting',REVISION_REQUIRED:'blocked',CONTENT_BLOCKED:'blocked',TECHNICAL_FAILURE:'blocked',ITERATION_LIMIT_REACHED:'blocked',CLIENT_READY:'waiting',FINAL_APPROVED:'complete',CANCELLED:'cancelled'} as Record<string,string>)[r?.status] || p.status;
export class DevLabStudioAdapter implements StudioAdapter {
  readonly mode = 'devlab' as const;
  readonly capabilities: StudioCapabilities;
  private source:ReadSource;
  private cachedAt = 0;
  private pending = new Map<string,Promise<ProjectDetail>>();
  constructor(private config:DevLabConfig={}, source?:ReadSource) {
    this.source=source || new SupabaseReadSource(config.DEVLAB_SUPABASE_URL,config.DEVLAB_SUPABASE_SERVICE_ROLE_KEY);
    const configured=!!(source || (config.DEVLAB_SUPABASE_URL && config.DEVLAB_SUPABASE_SERVICE_ROLE_KEY)) && !!config.DEVLAB_READ_PROJECT_SLUGS;
    this.capabilities=Object.freeze({...unavailableCapabilities,canReadProjects:configured,canReadStages:configured,canReadAgents:configured,canReadRuns:configured,canReadEvents:configured,canReadArtifacts:configured,canReadIterations:configured,canReadApprovals:configured,canReadQA:configured,canReadReadiness:configured});
  }
  private slugs(){const s=(this.config.DEVLAB_READ_PROJECT_SLUGS||'').split(',').filter(x=>/^[a-z0-9][a-z0-9-]{0,79}$/.test(x));if(!s.length)throw new DevLabAdapterNotConfiguredError();return s;}
  private async projects(){return this.source.rows('creative_studio_projects',{slug:`in.(${this.slugs().join(',')})`,select:'id,slug,client_name,project_type,status,current_stage,brief_summary,goal,created_at,updated_at',order:'updated_at.desc'});}
  private async detail(id:string):Promise<ProjectDetail> {
    const p=(await this.projects()).find(p=>p.id===id || p.slug===id);if(!p)throw new StudioError('Project not found or not authorized.',404);
    const [runs,artifacts,iterations,reviews,approved,labs]=await Promise.all([
      this.source.rows('creative_studio_production_runs',{project_id:`eq.${p.id}`,select:'id,status,current_stage,responsible_agent,current_production_iteration,human_gate,blockers,client_ready,client_ready_result,started_at,updated_at',order:'run_number.desc',limit:'1'}),
      this.source.rows('creative_studio_artifacts',{project_id:`eq.${p.id}`,select:'id,artifact_type,title,created_at,version,created_by_agent',order:'created_at.desc'}),
      this.source.rows('creative_studio_production_iterations',{project_id:`eq.${p.id}`,select:'id,iteration_number,status,outcome,overall_score,dimension_scores,blocker_count,major_count,minor_count,created_at',order:'iteration_number.desc'}),
      this.source.rows('creative_studio_reviews',{project_id:`eq.${p.id}`,select:'id,review_type,scores,decision,created_at',order:'created_at.desc'}),
      this.source.rows('approvals',{action_type:`like.creative-studio:*:${p.slug}`,select:'id,action_type,approved_at',order:'approved_at.desc'}),
      this.source.rows('labs',{slug:'eq.dev-lab',select:'id',limit:'1'}),
    ]);
    const run=runs[0];
    const [events,agentRows]=await Promise.all([
      run?this.source.rows('creative_studio_production_run_events',{run_id:`eq.${run.id}`,select:'id,event_type,detail,created_at',order:'created_at.desc',limit:'200'}):Promise.resolve([]),
      labs[0]?this.source.rows('agents',{lab_id:`eq.${labs[0].id}`,select:'id,name,role,status'}):Promise.resolve([]),
    ]);
    // Only stages witnessed in CPE events plus its current stage. No copied lifecycle or inferred future stages.
    const observed = new Map<string,StudioStage>();
    for(const e of [...events].reverse()) if(e.event_type==='STAGE_ADVANCED') {
      if(typeof e.detail?.from==='string')observed.set(e.detail.from,{id:text(e.detail.from),name:text(e.detail.from),status:'complete'});
      if(typeof e.detail?.to==='string')observed.set(e.detail.to,{id:text(e.detail.to),name:text(e.detail.to),status:'active'});
    }
    observed.set(p.current_stage,{id:text(p.current_stage),name:text(p.current_stage),status:'active'});
    const stages=[...observed.values()];
    const project:StudioProject={id:p.id,name:text(p.client_name),industry:text(p.project_type),summary:text(p.brief_summary),status:status(run,p),stageId:text(p.current_stage),stages,createdAt:p.created_at,updatedAt:p.updated_at,theme:'forma',context:{...emptyContext,description:text(p.brief_summary),goals:text(p.goal)},archived:p.status==='archived',referenceIds:[],actions:[],slug:p.slug,sourceStatus:text(run?.status||p.status)};
    const agents=agentRows.map(a=>({id:a.id,name:text(a.name),role:text(a.role),status:run?.responsible_agent===a.name?(run.status==='RUNNING'?'working':'waiting'):'idle',task:run?.responsible_agent===a.name?text(run.current_stage):'No execution attributed to this project',projectId:p.id,latestResult:'',initials:text(a.name).split(' ').map(s=>s[0]).slice(0,2).join(''),color:'green'}));
    project.agentId=agents.find(a=>a.name===run?.responsible_agent)?.id;
    const approvals:StudioApproval[]=approved.map(a=>({id:a.id,projectId:p.id,title:text(a.action_type.split(':')[1]),description:'Recorded human approval in CPE',kind:text(a.action_type.split(':')[1]),status:'approved',createdAt:a.approved_at,resolvedAt:a.approved_at}));
    if(run?.human_gate) approvals.unshift({id:`${run.id}:${run.human_gate}`,projectId:p.id,title:text(run.human_gate),description:'CPE is waiting for human approval. Studio controls are disabled.',kind:text(run.human_gate),status:'pending',createdAt:run.updated_at});
    const blockers=Array.isArray(run?.blockers)?run.blockers:[];
    blockers.filter(b=>b.route==='HUMAN_DECISION_REQUIRED').forEach((b,i)=>approvals.unshift({id:`${run.id}:human:${i}`,projectId:p.id,title:'Human decision required',description:text(b.summary),kind:'HUMAN_DECISION_REQUIRED',status:'pending',createdAt:b.raisedAt||run.updated_at}));
    const reasons=Array.isArray(run?.client_ready_result?.reasons)?run.client_ready_result.reasons:[];
    const findings=[...blockers.map(b=>text(b.summary)),...reasons.map(text)].map((message,i)=>({id:`${run?.id}:finding:${i}`,section:'CPE readiness',message,severity:'blocker' as const}));
    const mappedReviews:StudioReview[]=reviews.map(r=>({projectId:p.id,categories:Object.entries(r.scores||{}).map(([id,value])=>({id,name:text(id),value:String(value),status:(r.decision==='approve'?'pass':r.decision==='reject'?'fail':'warning') as 'pass'|'fail'|'warning'})),issues:[]}));
    for(const i of iterations) mappedReviews.push({projectId:p.id,categories:Object.entries(i.dimension_scores||{}).map(([id,value])=>({id,name:text(id),value:String(value),status:'warning' as const})),issues:[]});
    const readiness={projectId:p.id,status:run?.client_ready?'ready':findings.length?'blocked':run?'not-ready':'unknown',clientReady:run?.client_ready===true,blockers:findings,summary:run?`CPE ${text(run.status)}; CLIENT_READY=${run.client_ready===true}. ${reasons.length} recorded readiness reasons.`:'No production run recorded.',assessedAt:run?.updated_at||p.updated_at,mode:this.mode};
    return {project,stages,agents,approvals,productionRun:run?{id:run.id,projectId:p.id,status:text(run.status),stageId:text(run.current_stage),startedAt:run.started_at,updatedAt:run.updated_at,mode:this.mode,iterationNumber:run.current_production_iteration,responsibleAgent:text(run.responsible_agent)}:null,
      events:events.map(e=>({id:e.id,projectId:p.id,message:text(e.event_type),createdAt:e.created_at,agentName:typeof e.detail?.agent==='string'?text(e.detail.agent):undefined,details:['from','to','stage','route','reason'].filter(k=>typeof e.detail?.[k]==='string').map(k=>`${k}: ${text(e.detail[k])}`).join(' · ')})),
      artifacts:artifacts.map(a=>({id:a.id,projectId:p.id,title:text(a.title),type:text(a.artifact_type),createdAt:a.created_at,metadata:{version:a.version,createdBy:text(a.created_by_agent),transport:'not-published'}})),
      iterations:iterations.map(i=>({id:i.id,projectId:p.id,name:`Iteration ${i.iteration_number}`,summary:`${text(i.outcome||i.status)}; blockers: ${i.blocker_count}`,createdAt:i.created_at,previewUrl:'',status:text(i.status)})),
      review:{projectId:p.id,categories:mappedReviews[0]?.categories||[],issues:findings},reviews:mappedReviews,readiness,media:[],capabilities:this.capabilities};
  }
  getProject:StudioAdapter['getProject']=(id)=>{if(Date.now()-this.cachedAt>2000){this.pending.clear();this.cachedAt=Date.now();}if(!this.pending.has(id))this.pending.set(id,this.detail(id));return this.pending.get(id)!;};
  getProjects:StudioAdapter['getProjects']=async()=>Promise.all((await this.projects()).map(async p=>{const {context,referenceIds,...summary}=(await this.getProject(p.id)).project;return summary;}));
  getSnapshot:StudioAdapter['getSnapshot']=async()=>{const projects=await this.getProjects();const d=await Promise.all(projects.map(p=>this.getProject(p.id)));return {mode:this.mode,capabilities:this.capabilities,projects,agents:d.flatMap(x=>x.agents),events:d.flatMap(x=>x.events).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),approvals:d.flatMap(x=>x.approvals),library:[]};};
  getStages:StudioAdapter['getStages']=async id=>(await this.getProject(id)).stages;
  getRunStatus:StudioAdapter['getRunStatus']=async id=>(await this.getProject(id)).project;
  getProductionRun:StudioAdapter['getProductionRun']=async id=>(await this.getProject(id)).productionRun;
  getAgents:StudioAdapter['getAgents']=async id=>id?(await this.getProject(id)).agents:(await this.getSnapshot()).agents;
  getEvents:StudioAdapter['getEvents']=async(id,options={})=>{if(options.limit!==undefined&&(!Number.isInteger(options.limit)||options.limit<1||options.limit>200))throw new StudioError('Invalid event limit.');if(options.before&&Number.isNaN(Date.parse(options.before)))throw new StudioError('Invalid event timestamp.');return (await this.getProject(id)).events.filter(e=>!options.before||Date.parse(e.createdAt)<Date.parse(options.before)).slice(0,options.limit||100);};
  getArtifacts:StudioAdapter['getArtifacts']=async id=>(await this.getProject(id)).artifacts;
  getIterations:StudioAdapter['getIterations']=async id=>(await this.getProject(id)).iterations;
  getApprovals:StudioAdapter['getApprovals']=async id=>(await this.getProject(id)).approvals;
  getReviews:StudioAdapter['getReviews']=async id=>(await this.getProject(id)).reviews;
  getReadiness:StudioAdapter['getReadiness']=async id=>(await this.getProject(id)).readiness;
  getMedia:StudioAdapter['getMedia']=async id=>(await this.getProject(id)).media;
  private async disabled():Promise<never>{if(!this.capabilities.canReadProjects)throw new DevLabAdapterNotConfiguredError();throw new StudioError('Real factory controls are disabled in Pass 1.',501);}
  getLibrary:StudioAdapter['getLibrary']=()=>this.disabled();
  createProject:StudioAdapter['createProject']=()=>this.disabled(); startRun:StudioAdapter['startRun']=()=>this.disabled();
  approveGate:StudioAdapter['approveGate']=()=>this.disabled(); pauseRun:StudioAdapter['pauseRun']=()=>this.disabled();
  resumeRun:StudioAdapter['resumeRun']=()=>this.disabled(); cancelRun:StudioAdapter['cancelRun']=()=>this.disabled();
  archiveProject:StudioAdapter['archiveProject']=()=>this.disabled(); updateContext:StudioAdapter['updateContext']=()=>this.disabled(); addAssets:StudioAdapter['addAssets']=()=>this.disabled();
}
