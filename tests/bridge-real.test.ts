import test from 'node:test';import assert from 'node:assert/strict';
import {environment} from './helpers/bridge-env';
import {BridgeQueue} from '../server/bridge-queue';
import {commandInput,REAL_PROJECT} from '../lib/bridge/validation.server';
import {CpeFence} from '../lib/bridge/cpe-fence.server';
import {validateJob,realCommandPlan,FACTORY_ROOT,mockExecute} from '../runner/executors';
import {supervisionDecision} from '../runner/supervision';
import worker from '../server/worker';
const input=(type='CREATE_PROJECT',payload:any={})=>({projectId:REAL_PROJECT,mode:'REAL',type,idempotencyKey:crypto.randomUUID(),payload});
const req=(b:unknown,token='operator-test')=>new Request('https://studio.test/api/bridge/commands',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:'https://studio.test','Content-Type':'application/json'},body:JSON.stringify(b)});
test('REAL vocabulary strictly fences project, payload, executable, cwd, pause and cancel in Worker and runner',async()=>{
 const e=environment();e.BRIDGE_REAL_COMMANDS='CREATE_PROJECT,START_RUN,APPROVE_GATE,RESUME_RUN';
 for(const slug of ['eagleswings-cpe2-trial','eagleswings','eagleswings-v2','bridge-disposable-other','arbitrary'])assert.equal((await worker.fetch(req({...input(),projectId:slug}),e)).status,400);
 for(const b of [{...input(),type:'CANCEL_RUN'},{...input(),type:'PAUSE_RUN'},{...input(),shellCommand:'x'},{...input(),payload:{cwd:'/'}}])assert.equal((await worker.fetch(req(b),e)).status,400);
 assert.throws(()=>realCommandPlan({type:'START_RUN',projectSlug:REAL_PROJECT},'/tmp/AI_COMMAND_CENTER-bridge'));
 assert.throws(()=>validateJob({project_id:'eagleswings',mode:'REAL'} as any));assert.equal((await worker.fetch(req(input(),''),e)).status,401);
 assert.equal((await worker.fetch(req(input(),'runner-test'),e)).status,403);e.db.close();
});
test('REAL admissions disabled by default; owner acceptance is explicit',async()=>{const e=environment();assert.equal((await worker.fetch(req(input()),e)).status,403);e.BRIDGE_REAL_COMMANDS='CREATE_PROJECT';assert.equal((await worker.fetch(req(input()),e)).status,503); /* Explicit admission still requires authoritative enrollment/configuration. */assert.equal((await worker.fetch(req(input('START_RUN')),e)).status,403);e.db.close();});
test('semantic idempotency prevents second create/start/approval/resume even with different request IDs',async()=>{
 const e=environment(),q=new BridgeQueue(e.DB);const runId=crypto.randomUUID();
 for(const [type,payload] of [['CREATE_PROJECT',{}],['START_RUN',{}],['APPROVE_GATE',{runId,expectedStage:'AWAITING_DIRECTION_APPROVAL',approvalType:'AWAITING_DIRECTION_APPROVAL',gate:'AWAITING_DIRECTION_APPROVAL'}],['RESUME_RUN',{runId,expectedStage:'EXPERIENCE_DESIGN'}]] as const){const a=await q.submit(input(type,payload),'owner');const b=await q.submit(input(type,payload),'owner-2');assert.equal(a.id,b.id);}
 assert.equal((await q.list()).length,4);e.db.close();
});
test('long REAL execution renews beyond initial lease; disconnect never requeues running job or admits concurrent real work',async()=>{
 const e=environment();let now=Date.now();const q=new BridgeQueue(e.DB,()=>new Date(now).toISOString());const a=await q.submit(input(),'owner');await q.submit(input('START_RUN'),'owner');
 assert.equal(await q.claim('mock'),null);const job=(await q.claim('mac','REAL'))!;await q.start(job.id,job.claim_token,'mac');const executionId=crypto.randomUUID();
 for(let i=0;i<20;i++){now+=15000;await q.progress(job.id,job.claim_token,'mac',executionId,123);assert.equal(await q.claim('other','REAL'),null);}
 now+=3600000;assert.equal(await q.claim('restart','REAL'),null);assert.equal((await q.list()).find(j=>j.id===a.id)?.status,'RUNNING');
 await assert.rejects(()=>q.progress(job.id,'wrong','mac',executionId),/stale/);
 await assert.rejects(()=>q.progress(job.id,job.claim_token,'mac',crypto.randomUUID()),/stale/);
 await q.progress(job.id,job.claim_token,'mac',executionId,123);await q.finish(job.id,job.claim_token,'mac',{ok:true,retryable:false,code:'REAL_COMPLETED',executionCount:1,executionId});
 await q.progress(job.id,job.claim_token,'mac',executionId);assert.ok(await q.claim('mac','REAL'));e.db.close();
});
test('queued REAL work remains durable while runner disconnected; stale claimed work requires a fresh fenced start',async()=>{const e=environment();let now=Date.now();const q=new BridgeQueue(e.DB,()=>new Date(now).toISOString());const a=await q.submit(input(),'owner');now+=3600000;assert.equal((await q.list())[0].status,'QUEUED');const j=(await q.claim('mac','REAL'))!;now+=61000;const k=(await q.claim('mac','REAL'))!;assert.equal(k.id,a.id);assert.notEqual(j.claim_token,k.claim_token);await assert.rejects(()=>q.start(j.id,j.claim_token,'mac'));e.db.close();});
test('restart recovery never treats missing or stale execution evidence as permission to spawn',()=>{const id=crypto.randomUUID(),now=Date.now();assert.equal(supervisionDecision(null,id),'uncertain');assert.equal(supervisionDecision({executionId:id,state:'running',progressAt:new Date(now-31000).toISOString()},id,now),'uncertain');assert.equal(supervisionDecision({executionId:'different',state:'complete'},id),'uncertain');assert.equal(supervisionDecision({executionId:id,state:'complete'},id),'complete');});
const runId=crypto.randomUUID();
function fixture(){const project={id:crypto.randomUUID(),slug:REAL_PROJECT,status:'active',current_stage:'AWAITING_DIRECTION_APPROVAL'};const run={id:runId,project_id:project.id,mode:'CLEAN_ROOM',status:'AWAITING_HUMAN_APPROVAL',current_stage:'AWAITING_DIRECTION_APPROVAL',human_gate:'AWAITING_DIRECTION_APPROVAL',lock_holder:null,lock_expires_at:null};const approvals:any[]=[];return {project,run,approvals,fence:new CpeFence({rows:async table=>table==='creative_studio_projects'?[project]:table==='creative_studio_production_runs'?[run]:table==='studio_project_authorizations'?[{project_id:project.id,slug:REAL_PROJECT,enabled:true,historically_denied:false,clean_room_required:true}]:approvals})};}
const approve=()=>commandInput.parse(input('APPROVE_GATE',{runId,expectedStage:'AWAITING_DIRECTION_APPROVAL',approvalType:'AWAITING_DIRECTION_APPROVAL',gate:'AWAITING_DIRECTION_APPROVAL'}));
test('approval reread rejects changed run, changed stage, cleared gate, type mismatch, existing approval and active CPE lock',async()=>{
 const a=fixture();await a.fence.validate(approve());a.project.current_stage='EXPERIENCE_DESIGN';await assert.rejects(()=>a.fence.validate(approve()),/Stale/);
 const b=fixture();b.run.id=crypto.randomUUID();await assert.rejects(()=>b.fence.validate(approve()),/Stale/);
 const c=fixture();c.run.human_gate='';await assert.rejects(()=>c.fence.validate(approve()),/match/);
 const d=fixture();d.approvals.push({id:'approved'});await assert.rejects(()=>d.fence.validate(approve()),/already/);
 const e=fixture();Object.assign(e.run,{lock_holder:'someone',lock_expires_at:new Date(Date.now()+60000).toISOString()});await assert.rejects(()=>e.fence.validate(approve()),/locked/);await e.fence.validate(approve(),'someone');
 assert.throws(()=>commandInput.parse(input('APPROVE_GATE',{...approve().payload,approvalType:'ANY'})));
});
test('resume requires same authoritative run after direction approval; start never reuses an existing run',async()=>{const a=fixture();await assert.rejects(()=>a.fence.validate(commandInput.parse(input('START_RUN'))),/already/);await assert.rejects(()=>a.fence.validate(commandInput.parse(input('RESUME_RUN',{runId,expectedStage:'AWAITING_DIRECTION_APPROVAL'}))),/Resume/);a.project.current_stage='EXPERIENCE_DESIGN';await a.fence.validate(commandInput.parse(input('RESUME_RUN',{runId,expectedStage:'EXPERIENCE_DESIGN'})));});
test('real plan fixes all arguments and mock executor cannot invoke it',()=>{const plan=realCommandPlan({type:'APPROVE_GATE',projectSlug:REAL_PROJECT,expectedGate:'AWAITING_DIRECTION_APPROVAL',runId,approvedBy:'owner@example.com'},FACTORY_ROOT);assert.deepEqual(plan.args.slice(0,4),['creative-studio','approve','--project',REAL_PROJECT]);assert.throws(()=>mockExecute({project_id:REAL_PROJECT,mode:'REAL',command_type:'CREATE_PROJECT',payload:'{}',idempotency_key:crypto.randomUUID()} as any),/refuses/);});
test('private real artifact transport verifies ownership, hash, safe bytes and authenticated delivery',async()=>{
 const e=environment();e.DEVLAB_SUPABASE_URL='https://cpe.test';e.DEVLAB_SUPABASE_SERVICE_ROLE_KEY='private-test';const sourceId=crypto.randomUUID(),projectId=crypto.randomUUID();const original=globalThis.fetch;
 globalThis.fetch=async (url)=>{const u=new URL(String(url));if(u.pathname.endsWith('creative_studio_projects'))return Response.json([{id:projectId,slug:REAL_PROJECT}]);if(u.pathname.endsWith('creative_studio_production_runs'))return Response.json([]);return Response.json(u.searchParams.get('id')==='eq.'+sourceId?[{id:sourceId}]:[]);};
 try{
  const {publishDisposableArtifact}=await import('../server/bridge-artifacts');const bytes=new TextEncoder().encode('{"projectSlug":"bridge-disposable-pass2","finding":"Public fictional content"}');const hash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');const body={sourceArtifactId:sourceId,mimeType:'application/json',base64:Buffer.from(bytes).toString('base64'),sha256:hash};
  const a=await publishDisposableArtifact(body,e);assert.equal(a.bytes,bytes.length);const again=await publishDisposableArtifact(body,e);assert.equal(a.id,again.id);
  const r=await worker.fetch(new Request('https://studio.test/api/bridge/artifacts/'+a.id,{headers:{Authorization:'Bearer operator-test'}}),e);assert.equal(r.status,200);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);assert.equal((await worker.fetch(new Request('https://studio.test/api/bridge/artifacts/'+a.id),e)).status,401);
  await assert.rejects(()=>publishDisposableArtifact({...body,sourceArtifactId:crypto.randomUUID()},e),/owned/);
  await assert.rejects(()=>publishDisposableArtifact({...body,sha256:'0'.repeat(64)},e),/hash/);
  await assert.rejects(()=>publishDisposableArtifact({...body,base64:Buffer.from('{"path":"/Users/private"}').toString('base64')},e),/private/);
 }finally{globalThis.fetch=original;e.db.close();}
});
test('CPE stdout and local command guidance stay private even in terminal queue responses',async()=>{const e=environment(),q=new BridgeQueue(e.DB);await q.submit(input(),'owner');const j=(await q.claim('mac','REAL'))!;await q.start(j.id,j.claim_token,'mac');const id=crypto.randomUUID();await q.progress(j.id,j.claim_token,'mac',id);await q.finish(j.id,j.claim_token,'mac',{ok:true,retryable:false,code:'REAL_COMPLETED',executionCount:1,executionId:id,stdout:'files: outputs/dev-lab/test; ./command.sh --private /Users/private'});const serialized=JSON.stringify(await q.list());assert.ok(!serialized.includes('outputs/dev-lab'));assert.ok(!serialized.includes('command.sh'));assert.ok(!serialized.includes('/Users/'));e.db.close();});
test('only explicit new requests can retry a proven zero-execution rejection; uncertain or executed jobs stay deduplicated',async()=>{
 const e=environment(),q=new BridgeQueue(e.DB);const original=input();const c=await q.submit(original,'owner'),j=(await q.claim('mac','REAL'))!;await q.start(j.id,j.claim_token,'mac');const executionId=crypto.randomUUID();await q.progress(j.id,j.claim_token,'mac',executionId);await q.finish(j.id,j.claim_token,'mac',{ok:false,retryable:false,code:'FENCE_REJECTED',executionCount:0,executionId});
 assert.equal((await q.submit(original,'owner')).id,c.id);const retry=await q.submit(input(),'owner');assert.notEqual(retry.id,c.id);
 const k=(await q.claim('mac','REAL'))!;await q.start(k.id,k.claim_token,'mac');const second=crypto.randomUUID();await q.progress(k.id,k.claim_token,'mac',second);await q.finish(k.id,k.claim_token,'mac',{ok:false,retryable:false,code:'REAL_FAILED',executionCount:1,executionId:second});assert.equal((await q.submit(input(),'owner')).id,retry.id);e.db.close();
});
test('even unclaimed REAL transport commands cannot use the mock cancellation endpoint',async()=>{const e=environment(),q=new BridgeQueue(e.DB);const c=await q.submit(input(),'owner');await assert.rejects(()=>q.cancelQueued(c.id),/mock transport/);assert.equal((await q.list())[0].status,'QUEUED');e.db.close();});
