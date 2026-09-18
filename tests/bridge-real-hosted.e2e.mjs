/** Explicit acceptance driver. Defaults to read-only status. Mutations require a named phase. */
import {chromium,expect} from '@playwright/test';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';import assert from 'node:assert/strict';
const phase=process.argv[2]||'status';const config=JSON.parse(readFileSync('.studio/operator.json','utf8'));
const file='.studio/pass2-hosted-proof.json';const evidence=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{startedAt:new Date().toISOString(),phases:{}};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({extraHTTPHeaders:{Authorization:'Bearer '+config.operatorToken,'OAI-Sites-Authorization':'Bearer '+config.siteToken},viewport:{width:1440,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(config.origin+'/bridge');await expect(page.getByRole('heading',{name:'Disposable factory control'})).toBeVisible({timeout:30000});
 const get=async()=>{const r=await page.request.get(config.origin+'/api/bridge/status');assert.equal(r.status(),200);return r.json();};
 const before=await get();let record={at:new Date().toISOString(),before:{runner:before.runner,real:before.real}};
 const labels={create:'Create disposable project',start:'START FACTORY',approve:'Approve fenced direction',resume:'Resume disposable run'};
 if(labels[phase]){
  const t=performance.now();const response=page.waitForResponse(r=>r.url().endsWith('/api/bridge/commands')&&r.request().method()==='POST');await page.getByRole('button',{name:labels[phase],exact:true}).click();const r=await response;assert.equal(r.status(),201);const job=await r.json();record.submitMs=Math.round(performance.now()-t);record.command=job;
  const repeated=page.waitForResponse(r=>r.url().endsWith('/api/bridge/commands')&&r.request().method()==='POST');await page.getByRole('button',{name:'Repeat real request',exact:true}).click();assert.equal((await (await repeated).json()).id,job.id);
  const distinct=await page.evaluate(async job=>{const r=await fetch('/api/bridge/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:job.project_id,mode:'REAL',type:job.command_type,payload:JSON.parse(job.payload),idempotencyKey:crypto.randomUUID()})});return {status:r.status,body:await r.json()};},job);assert.equal(distinct.status,201);assert.equal(distinct.body.id,job.id);record.duplicate={sameKeySameId:true,differentKeySameId:true,commandId:job.id};
  if(phase==='create'){assert.equal(before.runner?.online,false);const after=await get();assert.equal(after.commands.find(x=>x.id===job.id).status,'QUEUED');record.disconnectedQueueProof=true;}
  evidence.phases[phase]=record;
 }else if(phase==='probes'){
  record.rejections=[];for(const projectId of ['eagleswings-cpe2-trial','eagleswings','eagleswings-v2','bridge-disposable-other']){const r=await page.request.post(config.origin+'/api/bridge/commands',{data:{projectId,mode:'REAL',type:'START_RUN',payload:{},idempotencyKey:crypto.randomUUID()}});assert.equal(r.status(),400);record.rejections.push({projectId,status:r.status()});}
  for(const type of ['SHELL','PAUSE_RUN','CANCEL_RUN']){const r=await page.request.post(config.origin+'/api/bridge/commands',{data:{projectId:'bridge-disposable-pass2',mode:'REAL',type,payload:{},idempotencyKey:crypto.randomUUID()}});assert.equal(r.status(),400);record.rejections.push({type,status:r.status()});}
  evidence.phases.probes=record;
 }else{
  record.commands=before.commands.filter(c=>c.mode==='REAL');record.artifacts=before.artifacts;
  if(before.real?.projectId){const t=performance.now(),r=await page.request.get(config.origin+'/api/projects/'+before.real.projectId);assert.equal(r.status(),200);const d=await r.json();record.readMs=Math.round(performance.now()-t);assert.ok(!JSON.stringify(d).includes('/Users/'));
   record.observed={project:d.project.id,slug:d.project.slug,stage:d.project.stageId,productionRun:d.productionRun,approvals:d.approvals,readiness:d.readiness,events:d.events.slice(0,10),artifacts:d.artifacts};
   await page.goto(config.origin+'/projects/'+d.project.id);await expect(page.getByRole('heading',{name:d.project.name,exact:true})).toBeVisible();
  }
  for(const a of before.artifacts||[]){const t=performance.now(),r=await page.request.get(config.origin+a.previewUrl);assert.equal(r.status(),200);const bytes=await r.body();assert.equal(bytes.length,a.bytes);assert.ok(!bytes.toString().includes('/Users/'));record.artifactDeliveryMs=Math.round(performance.now()-t);record.artifactHash=(await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');assert.equal(record.artifactHash,a.sha256);}
  (evidence.observations||=[]).push(record);
 }
 record.browserErrors=errors;assert.equal(errors.length,0);writeFileSync(file,JSON.stringify(evidence,null,2),{mode:0o600});console.log(JSON.stringify({phase,...record}));
}finally{await browser.close();}
