import '../lib/studio-adapter/server-only';
import { StudioError } from '../lib/studio-adapter/errors';
export interface BridgeEnv {BRIDGE_RUNNER_TOKEN?:string;BRIDGE_OPERATOR_TOKEN?:string;BRIDGE_OWNER_EMAIL?:string;BRIDGE_VIEWER_EMAILS?:string;BRIDGE_RUNNER_ID?:string;}
async function equal(a:string,b?:string){if(!b||!a)return false;const digest=(s:string)=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));const [x,y]=await Promise.all([digest(a),digest(b)]);return new Uint8Array(x).every((v,i)=>v===new Uint8Array(y)[i]);}
export async function authenticate(request:Request,env:BridgeEnv):Promise<{role:'runner'|'owner'|'viewer';id:string}> {
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(await equal(token,env.BRIDGE_RUNNER_TOKEN))return {role:'runner',id:env.BRIDGE_RUNNER_ID||'hudson-mac-shadow'};
  if(await equal(token,env.BRIDGE_OPERATOR_TOKEN))return {role:'owner',id:'bridge-operator'};
  // These headers are injected/overwritten by the Sites dispatch boundary, never accepted at a public worker.dev origin.
  const email=request.headers.get('oai-authenticated-user-email')?.toLowerCase();
  const id=request.headers.get('oai-authenticated-user-id');
  if(email&&id&&email===env.BRIDGE_OWNER_EMAIL?.toLowerCase())return {role:'owner',id};
  if(email&&id&&(env.BRIDGE_VIEWER_EMAILS||'').toLowerCase().split(',').includes(email))return {role:'viewer',id};
  throw new StudioError('Sign in to access this Studio.',401);
}
