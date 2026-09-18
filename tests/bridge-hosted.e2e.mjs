/** Explicit hosted acceptance test: only synthetic bridge commands. Real CPE reads are GET-only. */
import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const config=JSON.parse(readFileSync('.studio/operator.json','utf8'));
const headers={Authorization:'Bearer '+config.operatorToken,'OAI-Sites-Authorization':'Bearer '+config.siteToken};
const evidence={observedAt:new Date().toISOString(),origin:config.origin,commands:[],measurements:{}};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({extraHTTPHeaders:headers,viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const start=performance.now();const response=await page.request.get(config.origin+'/api/studio');assert.equal(response.status(),200);const snapshot=await response.json();evidence.measurements.cpeSnapshotMs=Math.round(performance.now()-start);
 assert.equal(snapshot.mode,'devlab');const project=snapshot.projects.find(p=>p.slug==='eagleswings-cpe2-trial');assert.ok(project);
 const d=await (await page.request.get(config.origin+'/api/projects/'+project.id)).json();
 assert.equal(d.capabilities.canStartRun,false);assert.equal(d.capabilities.canApprove,false);assert.equal(d.capabilities.canCancelRun,false);assert.ok(!JSON.stringify(d).includes('/Users/'));
 evidence.realRead={projectId:project.id,slug:project.slug,stage:project.stageId,run:d.productionRun,latestEvents:d.events.slice(0,4).map(e=>({id:e.id,type:e.message,createdAt:e.createdAt})),approvals:d.approvals.map(a=>({id:a.id,kind:a.kind,status:a.status})),iterationRows:d.iterations.length,readiness:{status:d.readiness.status,clientReady:d.readiness.clientReady,reasonCount:d.readiness.blockers.length,assessedAt:d.readiness.assessedAt}};
 await page.goto(config.origin+'/projects/'+project.id);await expect(page.getByRole('heading',{name:project.name,exact:true})).toBeVisible({timeout:20000});await expect(page.getByText('READ ONLY · controls disabled')).toBeVisible();
 await page.goto(config.origin+'/bridge');await expect(page.getByRole('heading',{name:'Factory bridge.'})).toBeVisible({timeout:20000});
 await expect(page.getByRole('heading',{name:'FACTORY ONLINE',exact:true})).toBeVisible({timeout:25000});
 for(const scenario of ['success','fail-once','always-fail']){
  await page.getByLabel('Test scenario').selectOption(scenario);const t=performance.now();
  const submitted=page.waitForResponse(r=>r.url().endsWith('/api/bridge/commands')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Submit mock command',exact:true}).click();const create=await submitted;assert.equal(create.status(),201);const c=await create.json();const submitMs=Math.round(performance.now()-t);
  const row=page.locator(`[data-command-id="${c.id}"]`);const expected=scenario==='always-fail'?'FAILED':'SUCCEEDED';await expect(row.locator('.status')).toHaveText(expected,{timeout:45000});
  const state=await (await page.request.get(config.origin+'/api/bridge/status')).json();const done=state.commands.find(j=>j.id===c.id);evidence.commands.push({scenario,submitMs,roundTripMs:Math.round(performance.now()-t),...done});
  if(scenario==='success'){
   const repeat=page.waitForResponse(r=>r.url().endsWith('/api/bridge/commands')&&r.request().method()==='POST');await page.getByRole('button',{name:'Repeat same request'}).click();const again=await (await repeat).json();assert.equal(again.id,c.id);assert.equal(again.attempt_count,1);assert.equal(JSON.parse(again.result).executionCount,1);evidence.duplicate={commandId:again.id,idempotencyKey:again.idempotency_key,attemptCount:again.attempt_count,executionCount:JSON.parse(again.result).executionCount};
  }
 }
 const invalid=await page.evaluate(async()=>{const r=await fetch('/api/bridge/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:'bridge-smoke-test',type:'SHELL',mode:'MOCK',idempotencyKey:crypto.randomUUID(),payload:{shellCommand:'INVALID_SENTINEL_DO_NOT_EXECUTE'}})});return {status:r.status,body:await r.json()};});assert.equal(invalid.status,400);evidence.invalid=invalid;
 const artifactResponse=page.waitForResponse(r=>r.url().endsWith('/api/bridge/artifacts/synthetic'));await page.getByRole('button',{name:'Publish synthetic artifact'}).click();const artifact=await (await artifactResponse).json();const t=performance.now();const bytes=await page.request.get(config.origin+artifact.previewUrl);assert.equal(bytes.status(),200);assert.match(await bytes.text(),/synthetic proof/);evidence.artifact={...artifact,bytes:(await bytes.body()).length,retrievalMs:Math.round(performance.now()-t)};
 evidence.runner=(await (await page.request.get(config.origin+'/api/bridge/status')).json()).runner;assert.equal(errors.length,0);evidence.browserErrors=errors;
 mkdirSync('.studio',{recursive:true});writeFileSync('.studio/hosted-proof.json',JSON.stringify(evidence,null,2),{mode:0o600});console.log(JSON.stringify({result:'PASS',commandIds:evidence.commands.map(c=>c.id),realProject:project.slug,runner:evidence.runner,measurements:evidence.measurements}));
}finally{await browser.close();}
