import {z} from 'zod';
import type { D1Database,R2Bucket } from '@cloudflare/workers-types';
import {StudioError} from '../lib/studio-adapter/errors';
import {BridgeQueue} from './bridge-queue';
import type {BridgeEnv} from './bridge-auth';
export const syntheticArtifactId='eec4a1a7-91c7-4e73-97d7-05dbab06f6bb';
export const syntheticSVG='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#14212b"/><text x="30" y="105" fill="#82e3c5" font-size="22">Studio bridge · synthetic proof</text></svg>';
const artifact=()=>({id:syntheticArtifactId,type:'bridge-synthetic-image',title:'Synthetic bridge proof',mimeType:'image/svg+xml',previewUrl:`/api/bridge/artifacts/${syntheticArtifactId}`,downloadUrl:`/api/bridge/artifacts/${syntheticArtifactId}?download=1`,thumbnailUrl:`/api/bridge/artifacts/${syntheticArtifactId}`,metadata:{synthetic:true}});
export async function bridgeAPI(request:Request,env:BridgeEnv&{DB:D1Database;BUCKET:R2Bucket},actor:{role:string;id:string},readBody:(r:Request)=>Promise<unknown>):Promise<Response>{
  const url=new URL(request.url),path=url.pathname.replace('/api/bridge','');const q=new BridgeQueue(env.DB);const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
  if(request.method==='GET'&&path==='/status'){
    if(actor.role==='runner')throw new StudioError('Runner cannot read Studio data.',403);
    return json({mode:'MOCK',runner:await q.presence(env.BRIDGE_RUNNER_ID||'hudson-mac-shadow'),commands:actor.role==='owner'?await q.list():[],canSubmit:actor.role==='owner'});
  }
  if(path.startsWith('/runner/')){
    if(actor.role!=='runner')throw new StudioError('Runner authentication required.',403);
    if(request.method!=='POST')throw new StudioError('Method not allowed.',405);
    if(path==='/runner/heartbeat'){const body=z.object({online:z.boolean(),mode:z.literal('MOCK')}).strict().parse(await readBody(request));return json(await q.heartbeat(actor.id,body.online));}
    if(path==='/runner/claim'){z.object({}).strict().parse(await readBody(request));return json(await q.claim(actor.id));}
    const p=path.split('/');
    if(p.length===5&&z.uuid().safeParse(p[3]).success){
      if(p[4]==='start'){const b=z.object({token:z.uuid()}).strict().parse(await readBody(request));return json(await q.start(p[3],b.token,actor.id));}
      if(p[4]==='finish'){const b=z.object({token:z.uuid(),ok:z.boolean(),retryable:z.boolean(),code:z.enum(['MOCK_COMPLETED','MOCK_TRANSIENT_FAILURE','MOCK_PERMANENT_FAILURE','EXECUTION_UNCERTAIN']),executionCount:z.number().int().min(0).max(1)}).strict().refine(b=>b.ok?(b.code==='MOCK_COMPLETED'&&b.executionCount===1&&!b.retryable):b.code!=='MOCK_COMPLETED','Invalid executor result').parse(await readBody(request));return json(await q.finish(p[3],b.token,actor.id,b));}
    }
  }
  if(actor.role==='runner')throw new StudioError('Runner endpoint not permitted.',403);
  if(/^\/commands\/[a-f0-9-]{36}\/cancel$/.test(path)&&request.method==='POST'){
    if(actor.role!=='owner')throw new StudioError('Owner access required.',403);
    z.object({}).strict().parse(await readBody(request));return json(await q.cancelQueued(path.split('/')[2]));
  }
  if(path==='/commands'&&request.method==='POST'){
    if(actor.role!=='owner')throw new StudioError('Only the Studio owner may submit synthetic commands.',403);
    return json(await q.submit(await readBody(request),actor.id),201);
  }
  if(path==='/artifacts/synthetic'&&request.method==='POST'){
    if(actor.role!=='owner')throw new StudioError('Owner access required.',403);
    z.object({}).strict().parse(await readBody(request));await env.BUCKET.put('bridge/'+syntheticArtifactId,syntheticSVG);return json(artifact(),201);
  }
  if(path===`/artifacts/${syntheticArtifactId}`&&request.method==='GET'){
    const object=await env.BUCKET.get('bridge/'+syntheticArtifactId);if(!object)throw new StudioError('Synthetic artifact not published.',404);
    return new Response(object.body as unknown as ReadableStream,{headers:{'Content-Type':'image/svg+xml','Content-Security-Policy':"default-src 'none'; sandbox",'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store',...(url.searchParams.has('download')?{'Content-Disposition':'attachment; filename="bridge-proof.svg"'}:{})}});
  }
  throw new StudioError('Bridge endpoint not found.',404);
}
