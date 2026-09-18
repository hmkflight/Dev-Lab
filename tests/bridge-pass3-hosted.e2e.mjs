/** Pass 3 acceptance. Default status is read-only. Explicit phases mutate ONLY the disposable project. */
import {chromium,expect} from '@playwright/test';import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {createHash} from 'node:crypto';
const phase=process.argv[2]||'status',config=JSON.parse(readFileSync('.studio/operator.json','utf8'));
const file='.studio/pass3-hosted-proof.json',evidence=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{startedAt:new Date().toISOString(),phases:{}};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({extraHTTPHeaders:{Authorization:'Bearer '+config.operatorToken,'OAI-Sites-Authorization':'Bearer '+config.siteToken},viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(config.origin+'/bridge');await expect(page.getByRole('heading',{name:'Disposable factory control'})).toBeVisible({timeout:30000});
 const get=async()=>{const r=await page.request.get(config.origin+'/api/bridge/status');assert.equal(r.status(),200);return r.json();};
 const before=await get();assert.equal(before.real.projectSlug,'bridge-disposable-pass2');const record={at:new Date().toISOString(),before:{real:before.real,runner:before.runner}};
 if(['build','resume'].includes(phase)){
  assert.equal(before.real.stage,phase==='build'?'AWAITING_BUILD_APPROVAL':'IMPLEMENTATION');assert.equal(before.real.runId,'2aa4b130-5f9b-414b-8e40-ee576c75352a');
  const t=performance.now(),response=page.waitForResponse(r=>r.url().endsWith('/api/bridge/commands')&&r.request().method()==='POST');await page.getByRole('button',{name:phase==='build'?'Approve Build':'Resume disposable run',exact:true}).click();const r=await response;assert.equal(r.status(),201);const job=await r.json();record.submitMs=Math.round(performance.now()-t);record.command=job;
  for(const key of [job.idempotency_key,crypto.randomUUID()]){const r=await page.request.post(config.origin+'/api/bridge/commands',{data:{projectId:job.project_id,mode:'REAL',type:job.command_type,payload:JSON.parse(job.payload),idempotencyKey:key}});assert.equal(r.status(),201);assert.equal((await r.json()).id,job.id);}
  await expect.poll(async()=>{const j=(await get()).commands.find(x=>x.id===job.id);return ['SUCCEEDED','FAILED'].includes(j?.status)?j.status:'PENDING';},{timeout:120000,intervals:[2000]}).toBe('SUCCEEDED');
  record.roundTripMs=Math.round(performance.now()-t);record.after=await get();record.finalCommand=record.after.commands.find(x=>x.id===job.id);assert.equal(record.finalCommand.attempt_count,1);assert.equal(JSON.parse(record.finalCommand.result).executionCount,1);assert.equal(record.after.real.runId,before.real.runId);record.duplicates={sameKey:true,newKey:true};
  const repeated=await page.request.post(config.origin+'/api/bridge/commands',{data:{projectId:job.project_id,mode:'REAL',type:job.command_type,payload:JSON.parse(job.payload),idempotencyKey:crypto.randomUUID()}});assert.equal((await repeated.json()).id,job.id);
 }else if(phase==='stale'){
  record.tests=[];for(const kind of ['stage','run']){
   const b={projectId:'bridge-disposable-pass2',mode:'REAL',type:'APPROVE_GATE',idempotencyKey:crypto.randomUUID(),payload:{runId:kind==='run'?crypto.randomUUID():before.real.runId,expectedStage:kind==='stage'?'EXPERIENCE_REVIEW':before.real.stage,approvalType:'AWAITING_BUILD_APPROVAL',gate:'AWAITING_BUILD_APPROVAL'}};
   const r=await page.request.post(config.origin+'/api/bridge/commands',{data:b});assert.equal(r.status(),201);const job=await r.json();await expect.poll(async()=>(await get()).commands.find(x=>x.id===job.id)?.status,{timeout:60000,intervals:[2000]}).toBe('FAILED');const final=(await get()).commands.find(x=>x.id===job.id);assert.equal(JSON.parse(final.result).executionCount,0);assert.equal(JSON.parse(final.result).code,'FENCE_REJECTED');record.tests.push({kind,command:final});
  }
 }else if(phase==='artifacts'){
  assert.ok(before.artifacts.some(a=>a.mimeType==='application/json'));assert.ok(before.artifacts.some(a=>a.mimeType==='text/html'));assert.ok(before.artifacts.some(a=>a.mimeType==='image/png'));record.artifacts=[];
  for(const a of before.artifacts){const t=performance.now(),r=await page.request.get(config.origin+a.previewUrl);assert.equal(r.status(),200);const b=await r.body();assert.equal(b.length,a.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256);assert.ok(!b.toString().includes('/Users/'));assert.match(r.headers()['content-security-policy'],/sandbox/);const d=await page.request.get(config.origin+a.downloadUrl);assert.equal(d.status(),200);assert.match(d.headers()['content-disposition'],/attachment/);record.artifacts.push({...a,deliveryMs:Math.round(performance.now()-t)});}
  const html=before.artifacts.find(a=>a.mimeType==='text/html');await page.goto(config.origin+html.previewUrl);await expect(page.getByRole('heading',{name:'Report preview'})).toBeVisible();await expect(page.locator('body')).toContainText('not a built website');record.renderedHTML=true;
 }else{
  record.commands=before.commands.filter(x=>x.mode==='REAL');record.artifacts=before.artifacts;const t=performance.now();const r=await page.request.get(config.origin+'/api/projects/'+before.real.projectId);assert.equal(r.status(),200);const d=await r.json();record.readMs=Math.round(performance.now()-t);assert.ok(!JSON.stringify(d).includes('/Users/'));record.observed={project:d.project,run:d.productionRun,approvals:d.approvals,readiness:d.readiness,events:d.events.slice(0,10)};
  await page.goto(config.origin+'/projects/'+d.project.id);await expect(page.getByRole('heading',{name:d.project.name,exact:true})).toBeVisible();
 }
 assert.equal(errors.length,0);record.browserErrors=errors;evidence.phases[phase]=record;writeFileSync(file,JSON.stringify(evidence,null,2),{mode:0o600});console.log(JSON.stringify({phase,...record}));
}finally{await browser.close();}
