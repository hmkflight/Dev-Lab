import {readFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,sep,extname} from 'node:path';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {FACTORY_ROOT} from './executors';
import {REAL_PROJECT} from '../lib/bridge/validation.server';
import {SupabaseReadSource} from '../lib/studio-adapter/cpe-source.server';
import {CpeFence} from '../lib/bridge/cpe-fence.server';
import {validateArtifactBytes} from '../lib/bridge/artifact-content.server';
export function reportHTML(json:string){const escaped=json.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Disposable CPE report preview</title><style>body{background:#101c29;color:#e2edf3;font:16px system-ui;margin:0;padding:40px}small{color:#80ddc4}h1{font-size:28px}pre{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;background:#192c3b;padding:24px;border-radius:12px}</style></head><body><small>BRIDGE DISPOSABLE · AUTHORITATIVE CPE REPORT</small><h1>Report preview</h1><p>Rendered from a real CPE JSON artifact. This is a report view, not a built website or a production-readiness claim.</p><pre>'+escaped+'</pre></body></html>';}
const payload=(id:string,bytes:Buffer,mimeType:string,representation='original')=>({sourceArtifactId:id,mimeType,representation,base64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')});
export async function disposableArtifacts(projectSlug=REAL_PROJECT){
 const env=parseEnv(readFileSync(resolve(FACTORY_ROOT,'dashboard/.env.local'),'utf8'));
 const source=new SupabaseReadSource(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY);
 const {project}=await new CpeFence(source,projectSlug).authorize();if(!project)return [];
 const artifacts=await source.rows('creative_studio_artifacts',{project_id:`eq.${project.id}`,select:'id,filesystem_path,artifact_type',order:'created_at.asc'});
 const expectedRoot=resolve(FACTORY_ROOT,'outputs/dev-lab/client-projects',projectSlug),root=realpathSync(expectedRoot);if(root!==expectedRoot||realpathSync(FACTORY_ROOT)!==FACTORY_ROOT)throw Error('Artifact root cannot be redirected.');
 const result:ReturnType<typeof payload>[]=[];
 for(const a of artifacts){
  if(typeof a.filesystem_path!=='string')continue;
  const mime=({'.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.html':'text/html'} as Record<string,string>)[extname(a.filesystem_path)];if(!mime)continue;
  let file:string;try{file=realpathSync(resolve(FACTORY_ROOT,a.filesystem_path));}catch{continue;}
  if(!file.startsWith(root+sep)||statSync(file).size>500000)continue;
  const bytes=readFileSync(file);try{validateArtifactBytes(bytes,mime);}catch{continue;}
  result.push(payload(a.id,bytes,mime));
 }
 const original=result.find(x=>x.mimeType==='application/json');
 if(original){
  const html=reportHTML(JSON.stringify(JSON.parse(Buffer.from(original.base64,'base64').toString('utf8')),null,2));validateArtifactBytes(Buffer.from(html),'text/html');
  result.push(payload(original.sourceArtifactId,Buffer.from(html),'text/html','report-html'));
  if(process.env.BRIDGE_REPORT_THUMBNAILS==='1'){
  const {chromium}=await import('@playwright/test');const browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1});await page.route('**/*',r=>r.abort());await page.setContent(html,{waitUntil:'load'});const png=await page.screenshot({type:'png',fullPage:true});validateArtifactBytes(png,'image/png');result.push(payload(original.sourceArtifactId,png,'image/png','report-png'));}finally{await browser.close();}
  }
 }
 return result;
}
/** Compatibility for the Pass 2 JSON-only caller. */
export async function disposableArtifact(){return (await disposableArtifacts()).find(x=>x.representation==='original'&&x.mimeType==='application/json')||null;}
