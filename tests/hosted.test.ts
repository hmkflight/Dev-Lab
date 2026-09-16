import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server/worker';
import { emptyContext } from '../lib/studio-adapter/seed';
import { loadStudio } from '../server/hosted-storage';
function environment() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE studio_state (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL)');
  const DB = {prepare(sql:string) { let values: any[]=[]; const statement = {bind(...v:any[]) {values=v;return statement;},async run(){const r=db.prepare(sql).run(...values); return {meta:{changes:Number(r.changes)}};},async first(){return db.prepare(sql).get(...values) ?? null;}}; return statement;}};
  const blobs = new Map<string,ArrayBuffer>();
  return {DB,BUCKET:{async put(k:string,v:ArrayBuffer){blobs.set(k,v);},async get(k:string){const v=blobs.get(k);return v ? {body:v}:null;},async delete(keys:string[]){keys.forEach(k=>blobs.delete(k));}},ASSETS:{async fetch(r:Request){return new Response(new URL(r.url).pathname==='/index.html'?'studio':'missing',{status:new URL(r.url).pathname==='/index.html'?200:404});}}} as any;
}
const req=(path:string,data?:unknown,method='POST')=>new Request('https://studio.test'+path,data===undefined?undefined:{method,headers:{'Content-Type':'application/json',Origin:'https://studio.test'},body:JSON.stringify(data)});
test('hosted state survives independent requests and rejects stale writes',async()=>{
 const env=environment();
 const response=await worker.fetch(req('/api/projects',{name:'Hosted test',industry:'Design',context:emptyContext,referenceIds:[]}),env);
 assert.equal(response.status,201); const project=await response.json() as any;
 const started=await worker.fetch(req(`/api/projects/${project.id}/actions`,{action:'start'}),env); assert.equal(started.status,200);
 const read=await worker.fetch(req(`/api/projects/${project.id}`),env); assert.equal((await read.json() as any).project.status,'working');
 const a=await loadStudio(env.DB), b=await loadStudio(env.DB); await a.adapter.pauseRun(project.id); await a.save(); await b.adapter.pauseRun(project.id); await assert.rejects(b.save(),/another request/);
});
test('hosted uploads download original bytes and enforce same origin',async()=>{
 const env=environment();
 const created=await worker.fetch(req('/api/projects',{name:'Upload',industry:'',context:emptyContext,referenceIds:[]}),env); const project=await created.json() as any;
 const form=new FormData();form.append('files',new File(['hello upload'],'brief.txt',{type:'text/plain'}));
 const upload=new Request(`https://studio.test/api/projects/${project.id}/assets`,{method:'POST',body:form});
 const bytes=await upload.arrayBuffer();
 const result=await worker.fetch(new Request(upload.url,{method:'POST',headers:{'Content-Type':upload.headers.get('content-type')!,'Content-Length':String(bytes.byteLength),Origin:'https://studio.test'},body:bytes}),env);
 assert.equal(result.status,201); const assets=await result.json() as any[];
 const download=await worker.fetch(req(assets[0].downloadUrl),env);assert.equal(await download.text(),'hello upload');assert.match(download.headers.get('content-disposition')!,/^attachment/);
 const bad=req('/api/projects',{});bad.headers.set('origin','https://foreign.test');assert.equal((await worker.fetch(bad,env)).status,403);
 assert.equal((await worker.fetch(new Request('https://studio.test/projects/example',{headers:{accept:'text/html'}}),env)).status,200);
});
