import test from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import worker from '../server/worker';import {BridgeQueue} from '../server/bridge-queue';import {loadStudio} from '../server/hosted-storage';
import {mockExecute,realCommandPlan,executeReal} from '../runner/executors';
import {DevLabStudioAdapter} from '../lib/studio-adapter/devlab.server';import {SupabaseReadSource,publicText,type ReadSource} from '../lib/studio-adapter/cpe-source.server';
export function environment(){
 const db=new DatabaseSync(':memory:');for(const p of ['0000_tranquil_dust.sql','0001_glorious_boomerang.sql'])db.exec(readFileSync('drizzle/'+p,'utf8'));
 const DB={prepare(sql:string){let values:any[]=[];const statement={bind(...v:any[]){values=v;return statement;},async run(){const r=db.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};}};return statement;}};
 const objects=new Map();return {db,DB,BRIDGE_OPERATOR_TOKEN:'operator-test',BRIDGE_RUNNER_TOKEN:'runner-test',BRIDGE_RUNNER_ID:'test-mac',BRIDGE_OWNER_EMAIL:'owner@example.com',BRIDGE_VIEWER_EMAILS:'viewer@example.com',BUCKET:{async put(k:string,v:unknown){objects.set(k,v);},async get(k:string){return objects.has(k)?{body:objects.get(k)}:null;},async delete(keys:string[]){keys.forEach(k=>objects.delete(k));}},ASSETS:{async fetch(){return new Response('asset');}}} as any;
}
const input=(id=crypto.randomUUID(),scenario='success')=>({projectId:'bridge-smoke-test',type:'START_RUN',mode:'MOCK',idempotencyKey:id,payload:{scenario}});
const req=(path:string,body?:unknown,token='operator-test')=>new Request('https://studio.test/api/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,Origin:'https://studio.test','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
test('queue persists, owner submits, claim is atomic, start and completion are fenced',async()=>{
 const env=environment(),q=new BridgeQueue(env.DB),q2=new BridgeQueue(env.DB);
 const response=await worker.fetch(req('bridge/commands',input()),env);assert.equal(response.status,201);const created:any=await response.json();
 const claims=await Promise.all([q.claim('test-mac'),q2.claim('other-mac')]);assert.equal(claims.filter(Boolean).length,1);const job=claims.find(Boolean)!;
 await assert.rejects(()=>q.start(job.id,'bad',job.claimed_by!),/stale/);await q.start(job.id,job.claim_token,job.claimed_by!);
 await assert.rejects(()=>q.start(job.id,job.claim_token,job.claimed_by!),/already/);
 const result=mockExecute(job);const done=await q.finish(job.id,job.claim_token,job.claimed_by!,result);assert.equal(done.status,'SUCCEEDED');assert.equal(done.attempt_count,1);
 assert.equal(JSON.parse(done.result!).cpeInvoked,false);assert.equal((await q2.list())[0].id,created.id);assert.deepEqual(JSON.parse(done.history).map((h:any)=>h.status),['QUEUED','CLAIMED','RUNNING','SUCCEEDED']);
 assert.equal((await q.finish(job.id,job.claim_token,job.claimed_by!,result)).status,'SUCCEEDED');assert.equal(await q.claim('test-mac'),null);assert.ok(!('claim_token' in done));env.db.close();
});
test('idempotency reuses one command and rejects changed payload',async()=>{
 const env=environment(),q=new BridgeQueue(env.DB),data=input();const a=await q.submit(data,'owner');const b=await q.submit(data,'owner');assert.equal(a.id,b.id);assert.equal((await q.list()).length,1);
 await assert.rejects(()=>q.submit({...data,type:'RESUME_RUN'},'owner'),/different content/);env.db.close();
});
test('bounded transient retries recover and permanent exhaustion terminates',async()=>{
 const env=environment();let now=Date.now();const q=new BridgeQueue(env.DB,()=>new Date(now).toISOString());
 for(const scenario of ['fail-once','always-fail']){
  const c=await q.submit(input(crypto.randomUUID(),scenario),'owner');let executions=0;
  for(let i=0;i<3;i++){const j=await q.claim('mac');assert.ok(j);await q.start(j.id,j.claim_token,'mac');const result=mockExecute(j);executions+=result.executionCount;const done=await q.finish(j.id,j.claim_token,'mac',result);now+=3000;if(done.status!=='QUEUED')break;}
  const done=(await q.list()).find(x=>x.id===c.id)!;assert.equal(done.status,scenario==='fail-once'?'SUCCEEDED':'FAILED');assert.equal(done.attempt_count,scenario==='fail-once'?2:3);assert.equal(executions,scenario==='fail-once'?1:0);
 }env.db.close();
});
test('stale claimed jobs may retry but uncertain running jobs never replay',async()=>{
 const env=environment();let now=Date.now();const q=new BridgeQueue(env.DB,()=>new Date(now).toISOString());await q.submit(input(),'owner');const a=(await q.claim('mac'))!;now+=61000;const b=(await q.claim('mac'))!;assert.equal(a.id,b.id);assert.notEqual(a.claim_token,b.claim_token);await assert.rejects(()=>q.start(a.id,a.claim_token,'mac'));await q.start(b.id,b.claim_token,'mac');now+=61000;assert.equal(await q.claim('mac'),null);assert.equal((await q.list())[0].status,'FAILED');env.db.close();
});
test('heartbeat proves online, sleep timeout offline, and graceful shutdown offline',async()=>{
 const env=environment();let now=Date.now();const q=new BridgeQueue(env.DB,()=>new Date(now).toISOString());assert.equal(await q.presence('mac'),null);await q.heartbeat('mac');assert.equal((await q.presence('mac'))?.online,true);now+=45001;assert.equal((await q.presence('mac'))?.online,false);await q.heartbeat('mac');assert.equal((await q.presence('mac'))?.online,true);await q.heartbeat('mac',false);assert.equal((await q.presence('mac'))?.online,false);env.db.close();
});
test('worker rejects anonymous, viewers writing, owner impersonating runner, and runner reading CPE',async()=>{
 const env=environment();assert.equal((await worker.fetch(req('studio',undefined,''),env)).status,401);
 const viewer=req('bridge/commands',input(),'');viewer.headers.set('oai-authenticated-user-id','v');viewer.headers.set('oai-authenticated-user-email','viewer@example.com');assert.equal((await worker.fetch(viewer,env)).status,403);
 assert.equal((await worker.fetch(req('bridge/runner/claim',{}),env)).status,403);assert.equal((await worker.fetch(req('studio',undefined,'runner-test'),env)).status,403);
 assert.equal((await worker.fetch(req('bridge/runner/heartbeat',{mode:'MOCK',online:true},'runner-test'),env)).status,200);
 const cross=req('bridge/commands',input());cross.headers.set('origin','https://evil.test');assert.equal((await worker.fetch(cross,env)).status,403);env.db.close();
});
test('invalid vocabulary, arbitrary payloads, REAL mode and Eagle Wings commands are rejected before queue insertion',async()=>{
 const env=environment();for(const b of [{...input(),type:'SHELL'},{...input(),type:'CANCEL_RUN'},{...input(),type:'PAUSE_RUN'},{...input(),mode:'REAL'},{...input(),projectId:'eagleswings-cpe2-trial'},{...input(),payload:{shellCommand:'touch /tmp/pwn'}}])assert.equal((await worker.fetch(req('bridge/commands',b),env)).status,400);
 assert.equal((await new BridgeQueue(env.DB).list()).length,0);env.db.close();
});
test('synthetic artifact has safe URLs, private R2 bytes, and requires authentication',async()=>{
 const env=environment();const res=await worker.fetch(req('bridge/artifacts/synthetic',{}),env);assert.equal(res.status,201);const a:any=await res.json();for(const k of ['previewUrl','downloadUrl','thumbnailUrl'])assert.match(a[k],/^\/api\/bridge\/artifacts\//);assert.ok(!JSON.stringify(a).includes('/Users/'));
 const image=await worker.fetch(req(a.previewUrl.slice(5)),env);assert.match(await image.text(),/synthetic proof/);assert.equal(image.headers.get('cache-control'),'private, no-store');assert.equal((await worker.fetch(req(a.previewUrl.slice(5),undefined,''),env)).status,401);env.db.close();
});
test('real mapping never executes during planning, gates disabled, dangerous projects rejected',async()=>{
 const root='/Users/test/AI_COMMAND_CENTER-bridge';const projectSlug='bridge-disposable-smoke';assert.deepEqual(realCommandPlan({type:'START_RUN',projectSlug},root).args,['run','creative-studio:orchestrator','--','run','--project',projectSlug]);assert.ok(realCommandPlan({type:'CREATE_PROJECT',projectSlug},root).args.includes('create'));assert.ok(realCommandPlan({type:'RESUME_RUN',projectSlug},root).args.includes('run-resume'));
 for(const type of ['APPROVE_GATE','CANCEL_RUN','PAUSE_RUN','SHELL'])assert.throws(()=>realCommandPlan({type,projectSlug},root));assert.throws(()=>realCommandPlan({type:'START_RUN',projectSlug:'eagleswings-cpe2-trial'},root));await assert.rejects(()=>executeReal({type:'START_RUN',projectSlug},root),/disabled/);
});
const fixture:Record<string,any[]>={creative_studio_projects:[{id:'p',slug:'allowed',client_name:'Real project',project_type:'website',current_stage:'QA',status:'active',created_at:'2026-01-01',updated_at:'2026-01-02'}],creative_studio_production_runs:[{id:'r',status:'REVISION_REQUIRED',current_stage:'QA',responsible_agent:'Critic',current_production_iteration:2,client_ready:false,client_ready_result:{reasons:['Unsafe /Users/test/secret.png Bearer secret123']},blockers:[],updated_at:'2026-01-02'}],creative_studio_production_run_events:[{id:'e',event_type:'STAGE_ADVANCED',detail:{from:'BUILD',to:'QA',secret:'hidden'},created_at:'2026-01-02'}],creative_studio_artifacts:[{id:'a',title:'Artifact',artifact_type:'new-type',created_at:'2026-01-01',version:1,filesystem_path:'/Users/no',metadata:{token:'secret'}}],creative_studio_production_iterations:[{id:'i',iteration_number:2,status:'REVIEWED',dimension_scores:{novel_dimension:6},blocker_count:1}],creative_studio_reviews:[],approvals:[],labs:[{id:'l'}],agents:[{id:'agent',name:'Critic',role:'Critique'}]};
test('real read mappings use authoritative status and flexible fields, strip paths, preserve absent transport',async()=>{
 const source:ReadSource={rows:async table=>fixture[table]||[]};const a=new DevLabStudioAdapter({DEVLAB_READ_PROJECT_SLUGS:'allowed'},source);const d=await a.getProject('p');assert.equal(d.productionRun?.status,'REVISION_REQUIRED');assert.equal(d.productionRun?.iterationNumber,2);assert.equal(d.readiness.clientReady,false);assert.equal(d.project.actions.length,0);assert.equal(d.agents[0].id,'agent');assert.equal(d.iterations[0].previewUrl,'');assert.equal(d.artifacts[0].previewUrl,undefined);assert.ok(!JSON.stringify(d).includes('/Users'));assert.ok(!JSON.stringify(d).includes('secret123'));assert.equal(d.review.categories[0].id,'novel_dimension');assert.equal(a.capabilities.canReadProjects,true);assert.equal(a.capabilities.canReadQA,true);assert.equal(a.capabilities.canStartRun,false);await assert.rejects(()=>a.startRun('p'),/disabled/);await assert.rejects(()=>a.getProject('unauthorized'),/authorized/);
});
test('read source is GET-only, bounded and table allowlisted, upstream errors never disclose response bodies',async()=>{
 const calls:any[]=[];const source=new SupabaseReadSource('https://example.supabase.co','secret',async(url,init)=>{calls.push({url:String(url),...init});return Response.json([]);});await source.rows('creative_studio_projects',{select:'id'});assert.equal(calls[0].method,'GET');assert.equal(calls[0].redirect,'manual');assert.match(calls[0].url,/limit=200/);await assert.rejects(()=>source.rows('secrets',{}),/permitted/);
 const failed=new SupabaseReadSource('https://example.supabase.co','secret',async()=>new Response('secret raw body',{status:403}));await assert.rejects(()=>failed.rows('agents',{}),e=>!String(e).includes('secret raw body'));assert.equal(publicText('file:///Users/a/key'),'[local file]');
});
test('devlab hosted mutations have no generic save and cannot touch mock state',async()=>{
 const env=environment();env.DEVLAB_ADAPTER_MODE='devlab';const loaded=await loadStudio(env.DB,env);assert.equal(loaded.persistence,null);
 assert.equal((await worker.fetch(req('projects/p/actions',{action:'start'}),env)).status,501);assert.equal(env.db.prepare('SELECT count(*) AS n FROM studio_state').get().n,0);env.db.close();
});
