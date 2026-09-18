import {readFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {FACTORY_ROOT} from './executors';
import {REAL_PROJECT} from '../lib/bridge/validation.server';
import {SupabaseReadSource} from '../lib/studio-adapter/cpe-source.server';
import {CpeFence} from '../lib/bridge/cpe-fence.server';
export async function disposableArtifact(){
 const env=parseEnv(readFileSync(resolve(FACTORY_ROOT,'dashboard/.env.local'),'utf8'));
 const source=new SupabaseReadSource(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
 const {project}=await new CpeFence(source).state();if(!project)return null;
 const artifacts=await source.rows('creative_studio_artifacts',{project_id:`eq.${project.id}`,select:'id,filesystem_path,artifact_type',order:'created_at.asc'});
 const expectedRoot=resolve(FACTORY_ROOT,'outputs/dev-lab/client-projects',REAL_PROJECT),root=realpathSync(expectedRoot);if(root!==expectedRoot||realpathSync(FACTORY_ROOT)!==FACTORY_ROOT)throw Error('Artifact root cannot be redirected.');
 for(const a of artifacts){if(typeof a.filesystem_path!=='string'||extname(a.filesystem_path)!=='.json')continue;
  const file=realpathSync(resolve(FACTORY_ROOT,a.filesystem_path));if(!file.startsWith(root+sep)||statSync(file).size>500000)continue;
  const bytes=readFileSync(file),text=bytes.toString('utf8');if(/\/Users\/|\/home\/|file:\/\/|Bearer\s|(?:api[_-]?key|service_role|access_token|shellCommand)\s*["':=]/i.test(text))continue;
  JSON.parse(text);return {sourceArtifactId:a.id,mimeType:'application/json',base64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')};
 }return null;
}
