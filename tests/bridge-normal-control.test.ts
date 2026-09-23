import test from 'node:test';
import assert from 'node:assert/strict';
import {CpeFence} from '../lib/bridge/cpe-fence.server';
import {commandInput} from '../lib/bridge/validation.server';
import {BridgeQueue} from '../server/bridge-queue';
import {environment} from './helpers/bridge-env';
import {realCommandPlan,FACTORY_ROOT} from '../runner/executors';
const slug='normal-control-test';
const input=(type='CREATE_PROJECT')=>commandInput.parse({projectId:slug,mode:'REAL',type,payload:{},idempotencyKey:crypto.randomUUID()});
test('creation is permitted before enrollment only for the configured project; start requires enrollment',async()=>{
 const fence=new CpeFence({rows:async()=>[]},slug);
 await fence.validate(input());
 await assert.rejects(()=>fence.validate(input('START_RUN')),/explicitly Studio-enabled/);
 await assert.rejects(()=>fence.validate(commandInput.parse({...input(),projectId:'other-project'})),/not authorized/);
});
test('normal project queue is scoped, idempotent, and claims the configured project only',async()=>{
 const e=environment();const q=new BridgeQueue(e.DB,undefined,slug);
 const a=await q.submit(input(),'owner');const b=await q.submit(input(),'owner');assert.equal(a.id,b.id);
 await assert.rejects(()=>q.submit({...input(),projectId:'other-project'},'owner'),/not authorized/);
 assert.equal((await q.claim('test','REAL'))?.project_id,slug);e.db.close();
});
test('creation requires an authoritative local definition and fixed executable; job text is an argument',()=>{
 const previous=process.env.BRIDGE_PROJECT_SLUG;process.env.BRIDGE_PROJECT_SLUG=slug;
 try{
  assert.throws(()=>realCommandPlan({type:'CREATE_PROJECT',projectSlug:slug},FACTORY_ROOT),/definition/);
  const plan=realCommandPlan({type:'CREATE_PROJECT',projectSlug:slug,definition:{intake:{organization:'Literal $(never execute)'},implementation:{}}},FACTORY_ROOT);
  assert.equal(plan.file,FACTORY_ROOT+'/command.sh');assert.equal(plan.args[plan.args.indexOf('--slug')+1],slug);
  assert.throws(()=>realCommandPlan({type:'START_RUN',projectSlug:'other-project'},FACTORY_ROOT),/not authorized/);
 }finally{if(previous===undefined)delete process.env.BRIDGE_PROJECT_SLUG;else process.env.BRIDGE_PROJECT_SLUG=previous;}
});
test('repeated gates require a fresh timestamp, separate semantic identity and fixed CLI argument',async()=>{
 const runId='20000000-0000-4000-8000-000000000099',updated='2026-01-02T00:00:00.000Z',gate='AWAITING_BUILD_APPROVAL';
 const source={rows:async(table:string)=>table==='creative_studio_projects'?[{id:'p',slug,current_stage:gate,status:'active',updated_at:updated}]:table==='creative_studio_production_runs'?[{id:runId,mode:'CLEAN_ROOM',current_stage:gate,human_gate:gate,status:'AWAITING_HUMAN_APPROVAL'}]:table==='studio_project_authorizations'?[{project_id:'p',slug,enabled:true,historically_denied:false,clean_room_required:true}]:[{id:'earlier-approval'}]};
 const fence=new CpeFence(source,slug);
 const data=commandInput.parse({projectId:slug,mode:'REAL',type:'APPROVE_GATE',idempotencyKey:crypto.randomUUID(),payload:{runId,expectedStage:gate,gate,approvalType:gate,expectedProjectUpdatedAt:updated}});
 if(data.mode!=='REAL'||data.type!=='APPROVE_GATE')throw Error('Unexpected fixture type');
 await fence.validate(data);
 await assert.rejects(()=>fence.validate({...data,payload:{...data.payload,expectedProjectUpdatedAt:'2026-01-01T00:00:00.000Z'}}),/Stale gate revision/);
 await assert.rejects(()=>fence.validate({...data,payload:{...data.payload,expectedProjectUpdatedAt:undefined}}),/repeated gate/);
 const e=environment(),q=new BridgeQueue(e.DB,undefined,slug);
 const first=await q.submit(data,'owner'),duplicate=await q.submit({...data,idempotencyKey:crypto.randomUUID()},'owner');assert.equal(first.id,duplicate.id);
 const next=await q.submit({...data,idempotencyKey:crypto.randomUUID(),payload:{...data.payload,expectedProjectUpdatedAt:'2026-01-03T00:00:00.000Z'}},'owner');assert.notEqual(first.id,next.id);e.db.close();
});
