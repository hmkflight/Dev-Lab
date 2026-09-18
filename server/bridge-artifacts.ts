import {artifactMimes,validateArtifactBytes} from '../lib/bridge/artifact-content.server';
import {z} from 'zod';
import type {D1Database,R2Bucket} from '@cloudflare/workers-types';
import {StudioError} from '../lib/studio-adapter/errors';
import {cpeFence} from '../lib/bridge/cpe-fence.server';
import {REAL_PROJECT} from '../lib/bridge/validation.server';
import type {BridgeEnv} from './bridge-auth';
export async function publishDisposableArtifact(input:unknown,env:BridgeEnv&{DB:D1Database;BUCKET:R2Bucket}){
 const b=z.object({sourceArtifactId:z.uuid(),mimeType:z.enum(artifactMimes),representation:z.enum(['original','report-html','report-png']).default('original'),base64:z.string().max(700000),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(input);
 const fence=cpeFence(env),{project}=await fence.state();if(!project)throw new StudioError('Disposable project not found.',404);
 const rows=await fence.source.rows('creative_studio_artifacts',{id:`eq.${b.sourceArtifactId}`,project_id:`eq.${project.id}`,select:'id',limit:'1'});if(!rows.length)throw new StudioError('Artifact is not owned by the authorized disposable project.',403);
 let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(b.base64),c=>c.charCodeAt(0));}catch{throw new StudioError('Invalid artifact encoding.',400);}
 validateArtifactBytes(bytes,b.mimeType);
 if((b.representation==='report-html'&&b.mimeType!=='text/html')||(b.representation==='report-png'&&b.mimeType!=='image/png'))throw new StudioError('Representation MIME mismatch.',400);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==b.sha256)throw new StudioError('Artifact hash mismatch.',400);
 const prior=await env.DB.prepare('SELECT * FROM bridge_artifacts WHERE source_artifact_id=? AND representation=?').bind(b.sourceArtifactId,b.representation).first<any>();if(prior){if(prior.sha256!==hash)throw new StudioError('Published source is immutable.',409);return prior;}
 const id=crypto.randomUUID();await env.BUCKET.put('bridge-real/'+id,bytes);
 await env.DB.prepare('INSERT INTO bridge_artifacts(id,source_artifact_id,representation,project_id,mime_type,bytes,sha256,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,b.sourceArtifactId,b.representation,REAL_PROJECT,b.mimeType,bytes.length,hash,new Date().toISOString()).run();
 return {id,sourceArtifactId:b.sourceArtifactId,representation:b.representation,mimeType:b.mimeType,bytes:bytes.length,sha256:hash};
}
