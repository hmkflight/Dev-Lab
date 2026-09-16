import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StageProgress } from "../src/components/Motion";
import { beginRequest, requestActivity } from "../src/request-activity";
import { api } from "../src/api";

test("stage progress counts only completed stages and handles an empty plan", () => {
  const markup = renderToStaticMarkup(createElement(StageProgress, {stages:[
    {id:"a",name:"A",status:"complete"}, {id:"b",name:"B",status:"active"}, {id:"c",name:"C",status:"pending"},
  ],active:true}));
  assert.match(markup,/aria-valuenow="1"/);
  assert.match(markup,/aria-valuemax="3"/);
  assert.match(markup,/1 of 3 stages complete/);
  const empty = renderToStaticMarkup(createElement(StageProgress, {stages:[]}));
  assert.match(empty,/aria-valuenow="0"/);
  assert.match(empty,/No stages defined/);
  assert.doesNotMatch(empty,/NaN|Infinity/);
});
test("loading activity handles concurrent requests and repeated cleanup", () => {
  const a=beginRequest(), b=beginRequest();
  assert.equal(requestActivity.getSnapshot(),2);
  a();a();assert.equal(requestActivity.getSnapshot(),1);
  b();assert.equal(requestActivity.getSnapshot(),0);
});
test("API failures clear loading state and background polling stays silent", async t => {
  t.mock.method(globalThis,"fetch",async()=>{assert.equal(requestActivity.getSnapshot(),1);throw new Error("Offline");});
  await assert.rejects(()=>api.snapshot(),/Offline/);
  assert.equal(requestActivity.getSnapshot(),0);
  t.mock.restoreAll();
  t.mock.method(globalThis,"fetch",async()=>{assert.equal(requestActivity.getSnapshot(),0);return Response.json({mode:"mock"});});
  await api.snapshot(true);
  assert.equal(requestActivity.getSnapshot(),0);
  t.mock.restoreAll();
  t.mock.method(globalThis,"fetch",async()=>new Response("malformed JSON"));
  await assert.rejects(()=>api.snapshot());
  assert.equal(requestActivity.getSnapshot(),0);
});
