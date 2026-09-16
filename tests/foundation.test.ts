import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockStudioAdapter } from "../lib/studio-adapter/mock";
import { DevLabStudioAdapter } from "../lib/studio-adapter/devlab.server";
import { DevLabAdapterNotConfiguredError } from "../lib/studio-adapter/errors";
import { getStudioAdapter } from "../lib/studio-adapter/index.server";
import { browserArtifactUrl, toStudioArtifact } from "../lib/studio-adapter/artifact.server";
import { createSeed } from "../lib/studio-adapter/seed";
import { emptyContext } from "../lib/studio-adapter/defaults";
import { performAction, requireCapability } from "../server/studio-actions";
import { loadStudio } from "../server/hosted-storage";
import type { StudioAdapter } from "../lib/studio-adapter/types";
// @ts-expect-error JavaScript build tooling.
import { assertClientBoundary } from "../scripts/client-boundary.mjs";
const mock: StudioAdapter = new MockStudioAdapter();
const devlab: StudioAdapter = new DevLabStudioAdapter();
const input = {name:"Foundation test",industry:"Design",context:emptyContext,referenceIds:[]};
test("resolver defaults to mock, selects devlab without requiring config, and rejects unknown modes", () => {
  assert.equal(getStudioAdapter({env:{},persistence:"memory"}).mode,"mock");
  assert.equal(getStudioAdapter({env:{DEVLAB_ADAPTER_MODE:"devlab"},persistence:"memory"}).mode,"devlab");
  assert.throws(()=>getStudioAdapter({env:{DEVLAB_ADAPTER_MODE:"invalid"},persistence:"memory"}),/Unsupported/);
});
test("every DevLab operation fails explicitly even when configuration is provided", async () => {
  const adapter: StudioAdapter = new DevLabStudioAdapter({DEVLAB_ROOT:"/private/not-accessed",DEVLAB_API_URL:"https://not-accessed.example"});
  const calls: Array<()=>Promise<unknown>> = [
    ()=>adapter.getSnapshot(),()=>adapter.getProjects(),()=>adapter.getProject("p"),()=>adapter.createProject(input),
    ()=>adapter.getStages("p"),()=>adapter.getAgents("p"),()=>adapter.getProductionRun("p"),()=>adapter.getRunStatus("p"),
    ()=>adapter.getEvents("p"),()=>adapter.getArtifacts("p"),()=>adapter.getIterations("p"),()=>adapter.getApprovals("p"),
    ()=>adapter.getReviews("p"),()=>adapter.getReadiness("p"),()=>adapter.getMedia("p"),()=>adapter.getLibrary(),
    ()=>adapter.startRun("p"),()=>adapter.resumeRun("p"),()=>adapter.pauseRun("p"),()=>adapter.cancelRun("p"),
    ()=>adapter.approveGate("p","a",{decision:"approve"}),()=>adapter.archiveProject("p"),
    ()=>adapter.updateContext("p",emptyContext),()=>adapter.addAssets("p",[]),
  ];
  for (const call of calls) await assert.rejects(call,DevLabAdapterNotConfiguredError);
});
test("hosted devlab mode never reads or initializes mock storage",async()=>{
  const db = new Proxy({}, {get(){throw new Error("Unexpected storage access");}});
  const {adapter}=await loadStudio(db as never,{DEVLAB_ADAPTER_MODE:"devlab"});
  await assert.rejects(()=>adapter.getSnapshot(),DevLabAdapterNotConfiguredError);
});
test("mock exposes realistic project views, independent snapshots, and flexible collections",async()=>{
  const summary=await mock.getProjects();
  assert.equal(summary.find(p=>p.id==="forma")?.status,"working");
  assert.equal(summary.find(p=>p.id==="offscript")?.status,"waiting");
  assert.equal(summary.find(p=>p.id==="kinfolk")?.status,"blocked");
  assert.ok(summary.every(p=>!("context" in p)));
  assert.equal((await mock.getSnapshot()).mode,"mock");
  for (const id of ["forma","offscript","kinfolk"]) {
    assert.ok((await mock.getStages(id)).length);
    assert.ok((await mock.getAgents(id)).every(a=>a.projectId===id));
    assert.ok((await mock.getIterations(id)).length>=2);
    assert.ok((await mock.getArtifacts(id)).length);
    assert.ok((await mock.getReviews(id)).length);
    assert.equal((await mock.getProductionRun(id))?.projectId,id);
  }
  assert.ok((await mock.getMedia("forma")).every(a=>a.downloadUrl && a.title));
  assert.equal((await mock.getReadiness("kinfolk")).status,"blocked");
  assert.equal((await mock.getReadiness("forma")).clientReady,false);
  const d=await mock.getProject("forma");d.project.stages.length=0;d.review.issues.length=0;d.agents.length=0;
  assert.ok((await mock.getStages("forma")).length);
  assert.ok((await mock.getReviews("forma"))[0].issues.length);
  const seed=createSeed();seed.projects[0].stages.push({id:"custom",name:"Custom stage",status:"queued-externally"});
  seed.agents.push({...seed.agents[0],id:"custom-agent"});
  const flexible=new MockStudioAdapter(undefined,seed);
  assert.equal((await flexible.getStages("forma")).at(-1)?.id,"custom");
  assert.equal((await flexible.getAgents()).length,seed.agents.length);
  await assert.rejects(()=>mock.getStages("missing"),/not found/);
  await assert.rejects(()=>mock.getAgents("missing"),/not found/);
});
test("event and library filters work and invalid limits fail",async()=>{
  const events=await mock.getEvents("forma",{limit:1});assert.equal(events.length,1);
  assert.ok((await mock.getEvents("forma",{before:events[0].createdAt})).every(e=>e.createdAt<events[0].createdAt));
  await assert.rejects(()=>mock.getEvents("forma",{limit:-1}));
  await assert.rejects(()=>mock.getEvents("forma",{before:"invalid"}));
  assert.ok((await mock.getLibrary({category:"Typography"})).every(l=>l.category==="Typography"));
  assert.equal((await mock.getLibrary({query:"nonexistent"})).length,0);
});
test("capabilities describe demo support honestly and protect actions",async()=>{
  assert.equal(mock.capabilities.canStartRun,true);assert.equal(mock.capabilities.canApprove,true);
  assert.equal(mock.capabilities.canStreamEvents,false);assert.equal(mock.capabilities.canControlAgents,false);
  assert.ok(Object.values(devlab.capabilities).every(v=>v===false));
  await assert.rejects(()=>performAction(devlab,"p","advance-demo"),/unavailable/);
  assert.throws(()=>requireCapability(devlab,"canApprove"),/unavailable/);
});
test("artifact output strips legacy fields and rejects filesystem and unsafe URLs",async()=>{
  for (const url of ["/Users/me/output.png","file:///tmp/secret","javascript:alert(1)","//evil.example/file","/previews/../secret","/previews/%2e%2e/secret","C:\\private\\file","https://user:pass@example.com/file","https://localhost/file"]) assert.throws(()=>browserArtifactUrl(url),/Invalid/);
  assert.equal(browserArtifactUrl("/api/assets/abc"),"/api/assets/abc");
  const a=toStudioArtifact({id:"a",projectId:"p",name:"Screenshot",type:"custom-kind",url:"/previews/forma.html",createdAt:"2026-01-01",path:"/Users/private",secret:"sensitive"});
  assert.equal(a.title,"Screenshot");assert.equal(a.previewUrl,"/previews/forma.html");
  assert.ok(!("path" in a));assert.ok(!("url" in a));assert.ok(!("secret" in a));
  for (const artifact of await mock.getArtifacts("forma")) assert.ok(artifact.title && artifact.metadata);
});
test("client import graph rejects transitive and dynamic server dependencies",()=>{
  assertClientBoundary(process.cwd());
  const root=mkdtempSync(join(tmpdir(),"studio-boundary-"));
  try {
    mkdirSync(join(root,"src"));mkdirSync(join(root,"lib/studio-adapter"),{recursive:true});
    writeFileSync(join(root,"lib/studio-adapter/mock.ts"),'export const mock=1;');
    writeFileSync(join(root,"src/bridge.ts"),'export {mock} from "../lib/studio-adapter/mock";');
    writeFileSync(join(root,"src/main.tsx"),'import "./bridge";');
    assert.throws(()=>assertClientBoundary(root),/Server-only/);
    writeFileSync(join(root,"src/main.tsx"),'import("../lib/studio-adapter/mock");');
    assert.throws(()=>assertClientBoundary(root),/Server-only/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
