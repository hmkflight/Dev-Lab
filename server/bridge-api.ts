import {authorizeRealProject,type ProjectAuthorization} from '../lib/bridge/project-authorization.server';
import {publishDisposableArtifact} from './bridge-artifacts';
import {commandInput,outcomeSchema,REAL_PROJECT,realTypes} from '../lib/bridge/validation.server';
import {cpeFence} from '../lib/bridge/cpe-fence.server';
import type {ArtifactTransport} from '../lib/studio-adapter/artifact.server';
import {z} from 'zod';
import type { D1Database,R2Bucket } from '@cloudflare/workers-types';
import {StudioError} from '../lib/studio-adapter/errors';
import {BridgeQueue} from './bridge-queue';
import type {BridgeEnv} from './bridge-auth';
export const syntheticArtifactId='eec4a1a7-91c7-4e73-97d7-05dbab06f6bb';
export const syntheticSVG='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#14212b"/><text x="30" y="105" fill="#82e3c5" font-size="22">Studio bridge · synthetic proof</text></svg>';
const transport:ArtifactTransport={urls(id){if(id!==syntheticArtifactId)throw new StudioError('Artifact not authorized.',404);return {previewUrl:`/api/bridge/artifacts/${id}`,downloadUrl:`/api/bridge/artifacts/${id}?download=1`,thumbnailUrl:`/api/bridge/artifacts/${id}`};}};
const artifact=()=>({id:syntheticArtifactId,type:'bridge-synthetic-image',title:'Synthetic bridge proof',mimeType:'image/svg+xml',...transport.urls(syntheticArtifactId),metadata:{synthetic:true}});
export async function bridgeAPI(request:Request,env:BridgeEnv&{DB:D1Database;BUCKET:R2Bucket},actor:{role:string;id:string},readBody:(r:Request)=>Promise<unknown>):Promise<Response>{
  const url=new URL(request.url),path=url.pathname.replace('/api/bridge','');const q=new BridgeQueue(env.DB);const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method==='GET'&&path==='/status'){
    if(actor.role==='runner')throw new StudioError('Runner cannot read Studio data.',403);
    const allowed=(env.BRIDGE_REAL_COMMANDS||'').split(',').filter(x=>(realTypes as readonly string[]).includes(x));const proven=(env.BRIDGE_PROVEN_COMMANDS||'').split(',').filter(x=>allowed.includes(x));
    const fence=cpeFence(env),state=allowed.length?await fence.state():undefined;
    let studioEnabled=false;if(state?.project){const entries=await fence.source.rows('studio_project_authorizations',{slug:`eq.${REAL_PROJECT}`,select:'project_id,slug,enabled,historically_denied,clean_room_required',limit:'1'});try{authorizeRealProject(REAL_PROJECT,state.project.id,entries[0] as ProjectAuthorization|undefined,state.run?.mode);studioEnabled=true;}catch(e){if(!(e instanceof StudioError)||e.status!==403)throw e;}}
    const objects=await env.DB.prepare('SELECT * FROM bridge_artifacts WHERE project_id=?').bind(REAL_PROJECT).all<any>();
    return json({mode:allowed.length?'REAL':'MOCK',real:{projectSlug:REAL_PROJECT,allowed,proven,studioEnabled,capabilities:{canCreateProject:false,canStartRun:studioEnabled&&proven.includes('START_RUN'),canResumeRun:studioEnabled&&proven.includes('RESUME_RUN'),canApprove:studioEnabled&&proven.includes('APPROVE_GATE'),canPauseRun:false,canCancelRun:false},projectId:state?.project?.id,runId:state?.run?.id,stage:state?.project?.current_stage,runStatus:state?.run?.status,gate:state?.run?.human_gate},artifacts:objects.results.map(a=>({id:a.id,sourceArtifactId:a.source_artifact_id,representation:a.representation,thumbnailUrl:a.mime_type.startsWith('image/')?`/api/bridge/artifacts/${a.id}`:undefined,mimeType:a.mime_type,bytes:a.bytes,sha256:a.sha256,previewUrl:`/api/bridge/artifacts/${a.id}`,downloadUrl:`/api/bridge/artifacts/${a.id}?download=1`})),runner:await q.presence(env.BRIDGE_RUNNER_ID||'hudson-mac-shadow'),commands:actor.role==='owner'?await q.list():[],canSubmit:actor.role==='owner'});
  }
  if(path.startsWith('/runner/')){
    if(actor.role!=='runner')throw new StudioError('Runner authentication required.',403);
    if(request.method!=='POST')throw new StudioError('Method not allowed.',405);
    if(path==='/runner/artifacts'){return json(await publishDisposableArtifact(await readBody(request),env),201);}
    if(path==='/runner/heartbeat'){const body=z.object({online:z.boolean(),mode:z.enum(['MOCK','REAL'])}).strict().parse(await readBody(request));return json(await q.heartbeat(actor.id,body.online,body.mode));}
    if(path==='/runner/claim'){const b=z.object({mode:z.enum(['MOCK','REAL']).default('MOCK')}).strict().parse(await readBody(request));return json(await q.claim(actor.id,b.mode));}
    const p=path.split('/');
    if(p.length===5&&z.uuid().safeParse(p[3]).success){
      if(p[4]==='start'){const b=z.object({token:z.uuid()}).strict().parse(await readBody(request));return json(await q.start(p[3],b.token,actor.id));}
      if(p[4]==='inspect'){const b=z.object({token:z.uuid(),executionId:z.uuid()}).strict().parse(await readBody(request));return json(await q.inspect(p[3],b.token,actor.id,b.executionId));}
      if(p[4]==='reconcile'){const b=z.object({token:z.uuid(),executionId:z.uuid(),classification:z.enum(['STILL_RUNNING','COMPLETED_SUCCESS','COMPLETED_FAILURE','SAFE_TO_RETRY','MANUAL_REVIEW_REQUIRED'])}).strict().parse(await readBody(request));return json(await q.reconcile(p[3],b.token,actor.id,b.executionId,b.classification));}
      if(p[4]==='progress'){const b=z.object({token:z.uuid(),executionId:z.uuid(),processId:z.number().int().positive().nullable().default(null)}).strict().parse(await readBody(request));return json(await q.progress(p[3],b.token,actor.id,b.executionId,b.processId));}
      if(p[4]==='finish'){const raw=await readBody(request) as Record<string,unknown>;const token=z.uuid().parse(raw.token);const {token:_,...rest}=raw;return json(await q.finish(p[3],token,actor.id,outcomeSchema.parse(rest)));}
    }
  }
  if(actor.role==='runner')throw new StudioError('Runner endpoint not permitted.',403);
  if(/^\/commands\/[a-f0-9-]{36}\/cancel$/.test(path)&&request.method==='POST'){
    if(actor.role!=='owner')throw new StudioError('Owner access required.',403);
    z.object({}).strict().parse(await readBody(request));return json(await q.cancelQueued(path.split('/')[2]));
  }
  if(path==='/commands'&&request.method==='POST'){
    if(actor.role!=='owner')throw new StudioError('Only the Studio owner may submit commands.',403);
    const data=commandInput.parse(await readBody(request));
    if(data.mode==='REAL'&&!(env.BRIDGE_REAL_COMMANDS||'').split(',').includes(data.type))throw new StudioError('This real command is not enabled for disposable acceptance.',403);
    if(data.mode==='REAL')await cpeFence(env).authorize();
    return json(await q.submit(data,actor.id),201);
  }
  if(path==='/artifacts/synthetic'&&request.method==='POST'){
    if(actor.role!=='owner')throw new StudioError('Owner access required.',403);
    z.object({}).strict().parse(await readBody(request));await env.BUCKET.put('bridge/'+syntheticArtifactId,syntheticSVG);return json(artifact(),201);
  }
  if(path===`/artifacts/${syntheticArtifactId}`&&request.method==='GET'){
    const object=await env.BUCKET.get('bridge/'+syntheticArtifactId);if(!object)throw new StudioError('Synthetic artifact not published.',404);
    return new Response(object.body as unknown as ReadableStream,{headers:{'Content-Type':'image/svg+xml','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store',...(url.searchParams.has('download')?{'Content-Disposition':'attachment; filename="bridge-proof.svg"'}:{})}});
  }
  if(/^\/artifacts\/[a-f0-9-]{36}$/.test(path)&&request.method==='GET'){
    const a=await env.DB.prepare('SELECT * FROM bridge_artifacts WHERE id=? AND project_id=?').bind(path.split('/')[2],REAL_PROJECT).first<any>();
    const object=a&&await env.BUCKET.get('bridge-real/'+a.id);if(!object)throw new StudioError('Artifact not published.',404);
    return new Response(object.body as unknown as ReadableStream,{headers:{'Content-Type':a.mime_type,'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox",'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store',...(url.searchParams.has('download')?{'Content-Disposition':`attachment; filename="disposable-artifact.${({'application/json':'json','image/png':'png','image/jpeg':'jpg','text/html':'html'} as Record<string,string>)[a.mime_type]||'bin'}"`}:{})}});
  }
  throw new StudioError('Bridge endpoint not found.',404);
}
