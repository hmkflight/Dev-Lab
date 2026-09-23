import test from 'node:test';import assert from 'node:assert/strict';
import {classifyReconciliation,processIdentity} from '../runner/reconciliation';
import {authorizeRealProject} from '../lib/bridge/project-authorization.server';
import {commandInput,REAL_PROJECT} from '../lib/bridge/validation.server';
import {realCommandPlan,FACTORY_ROOT} from '../runner/executors';
import {validateArtifactBytes} from '../lib/bridge/artifact-content.server';
import {reportHTML} from '../runner/artifacts';
import {SupabaseReadSource} from '../lib/studio-adapter/cpe-source.server';
import {BridgeQueue} from '../server/bridge-queue';import {environment} from './helpers/bridge-env';
const runId=crypto.randomUUID(),executionId=crypto.randomUUID();
const evidence={executionId,receipt:null,processMatches:false,authoritativeRunId:runId,expectedRunId:runId,queueStatus:'RUNNING',dispatchIntent:true,eventsObserved:2,authoritativeAvailable:true};
test('reconciliation distinguishes all five outcomes without granting uncertain replay',()=>{
 assert.equal(classifyReconciliation(evidence),'MANUAL_REVIEW_REQUIRED');
 assert.equal(classifyReconciliation({...evidence,dispatchIntent:false,queueStatus:'QUEUED'}),'SAFE_TO_RETRY');
 assert.equal(classifyReconciliation({...evidence,receipt:{executionId,state:'running'},processMatches:true}),'STILL_RUNNING');
 const result={executionId,executionCount:1,runId,ok:true,code:'REAL_COMPLETED'};
 assert.equal(classifyReconciliation({...evidence,receipt:{executionId,state:'complete',result}}),'COMPLETED_SUCCESS');
 assert.equal(classifyReconciliation({...evidence,receipt:{executionId,state:'complete',result:{...result,ok:false,code:'REAL_FAILED'}}}),'COMPLETED_FAILURE');
 assert.equal(classifyReconciliation({...evidence,receipt:{executionId,state:'complete',result},authoritativeRunId:crypto.randomUUID()}),'MANUAL_REVIEW_REQUIRED');
 assert.equal(classifyReconciliation({...evidence,receipt:{executionId,state:'complete',result},processMatches:true}),'MANUAL_REVIEW_REQUIRED');
 assert.equal(classifyReconciliation({...evidence,authoritativeAvailable:false}),'MANUAL_REVIEW_REQUIRED');
 assert.equal(classifyReconciliation({...evidence,receipt:{executionId,state:'complete',result:{...result,ok:false,executionCount:0,code:'FENCE_REJECTED'}},expectedRunId:crypto.randomUUID()}),'SAFE_TO_RETRY');
});
test('process identity includes kernel start time and does not accept nonexistent or arbitrary PID values',()=>{assert.match(processIdentity(process.pid)!,/^[a-f0-9]{64}$/);assert.equal(processIdentity(-1),null);assert.equal(processIdentity(NaN),null);});
test('enrollment, historical deny, protected namespaces and clean room remain mandatory for normal projects',()=>{
 const a={project_id:runId,slug:REAL_PROJECT,enabled:true,historically_denied:false,clean_room_required:true};authorizeRealProject(REAL_PROJECT,runId,a,'CLEAN_ROOM');authorizeRealProject('normal-project',runId,{...a,slug:'normal-project'},'CLEAN_ROOM');
 for(const slug of ['eagleswings-cpe2-trial','eagleswings','rt','research-trading'])assert.throws(()=>authorizeRealProject(slug,runId,{...a,slug},'CLEAN_ROOM'));
 assert.throws(()=>authorizeRealProject(REAL_PROJECT,undefined,a));assert.throws(()=>authorizeRealProject(REAL_PROJECT,runId,undefined));assert.throws(()=>authorizeRealProject(REAL_PROJECT,runId,{...a,enabled:false}));assert.throws(()=>authorizeRealProject(REAL_PROJECT,runId,{...a,historically_denied:true}));assert.throws(()=>authorizeRealProject(REAL_PROJECT,runId,a,'STANDARD'));
});
test('all approval gates require explicit run/type/stage and map to atomic CLI flags',()=>{
 for(const gate of ['AWAITING_DIRECTION_APPROVAL','AWAITING_BUILD_APPROVAL','AWAITING_FINAL_APPROVAL']){
  commandInput.parse({projectId:REAL_PROJECT,type:'APPROVE_GATE',mode:'REAL',idempotencyKey:crypto.randomUUID(),payload:{runId,expectedStage:gate,approvalType:gate,gate,...(gate==='AWAITING_DIRECTION_APPROVAL'?{selectedTrack:'editorial'}:{})}});
  const plan=realCommandPlan({type:'APPROVE_GATE',projectSlug:REAL_PROJECT,expectedGate:gate,...(gate==='AWAITING_DIRECTION_APPROVAL'?{selectedTrack:'editorial'}:{}),runId,approvedBy:'owner@example.com'},FACTORY_ROOT);
  assert.ok(plan.args.includes('--run-id'));assert.ok(plan.args.includes('--expected-stage'));assert.ok(plan.args.includes('--approval-type'));assert.ok(plan.args.includes('--approved-by'));
 }
 assert.throws(()=>realCommandPlan({type:'APPROVE_GATE',projectSlug:REAL_PROJECT,expectedGate:'AWAITING_BUILD_APPROVAL'},FACTORY_ROOT));
});
test('scoped reads use only the read gateway; token is not an arbitrary database credential',async()=>{
 let request:any;const source=new SupabaseReadSource('https://example.supabase.co',undefined,async(url,init)=>{request={url:String(url),...init};return Response.json([]);},'opaque-read-token');
 await source.rows('creative_studio_projects',{slug:'eq.bridge-disposable-pass2',select:'id'});
 assert.match(request.url,/\/functions\/v1\/studio-read$/);assert.equal(request.headers.apikey,undefined);assert.equal(JSON.parse(request.body).table,'creative_studio_projects');await assert.rejects(()=>source.rows('tasks',{}));
});
test('artifact MIME, size, passive HTML and local-path boundaries reject malicious representations',()=>{
 const bytes=(s:string)=>new TextEncoder().encode(s);validateArtifactBytes(bytes('{"public":true}'),'application/json');validateArtifactBytes(bytes(reportHTML('{"value":"<script>"}')),'text/html');
 for(const html of ['<!doctype html><script>alert(1)</script>','<!doctype html><img onerror="x">','<!doctype html><iframe src="https://bad">'])assert.throws(()=>validateArtifactBytes(bytes(html),'text/html'));
 for(const secret of ['sk-exampleverylongsecret','eyJhbGciOiJIUzI1NiJ9.payload.signature','outputs/dev-lab/client-projects/private'])assert.throws(()=>validateArtifactBytes(bytes(JSON.stringify({value:secret})),'application/json'));
 assert.throws(()=>validateArtifactBytes(bytes('/Users/private'),'application/json'));assert.throws(()=>validateArtifactBytes(bytes('not png'),'image/png'));assert.throws(()=>validateArtifactBytes(new Uint8Array(500001),'image/png'));
});
test('reconciliation writes require original runner, claim and execution identity and never requeue work',async()=>{
 const e=environment(),q=new BridgeQueue(e.DB);await q.submit({projectId:REAL_PROJECT,type:'START_RUN',mode:'REAL',payload:{},idempotencyKey:crypto.randomUUID()},'owner');const j=(await q.claim('mac','REAL'))!;await q.start(j.id,j.claim_token,'mac');await q.progress(j.id,j.claim_token,'mac',executionId);
 await assert.rejects(()=>q.reconcile(j.id,j.claim_token,'other',executionId,'STILL_RUNNING'));await assert.rejects(()=>q.inspect(j.id,j.claim_token,'mac',crypto.randomUUID()));
 const result=await q.reconcile(j.id,j.claim_token,'mac',executionId,'MANUAL_REVIEW_REQUIRED');assert.equal(result.status,'RUNNING');assert.equal(result.reconciliation,'MANUAL_REVIEW_REQUIRED');assert.equal(await q.claim('mac','REAL'),null);e.db.close();
});
