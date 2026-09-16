import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockStudioAdapter } from "../lib/studio-adapter/mock";
import { emptyContext } from "../lib/studio-adapter/seed";
const input = {
  name: "Test studio",
  industry: "Design",
  context: { ...emptyContext, description: "A test project." },
  referenceIds: ["lib-forma"],
};
test("complete intake → research → direction → design → build → QA → final approval", async () => {
  const adapter = new MockStudioAdapter();
  const p = await adapter.createProject(input);
  assert.equal(p.status, "draft");
  assert.ok(p.actions.includes("start"));
  await adapter.startRun(p.id);
  await adapter.advanceDemo(p.id);
  let d = await adapter.getProject(p.id);
  assert.equal(d.project.status, "waiting");
  assert.equal(d.project.stageId, "concept");
  await assert.rejects(() => adapter.advanceDemo(p.id), /not available/);
  await adapter.approveGate(p.id, d.approvals.at(-1)!.id, {decision:"approve",feedback:""});
  await adapter.advanceDemo(p.id);
  d = await adapter.getProject(p.id);
  assert.equal(d.approvals.at(-1)?.kind, "Build");
  await adapter.approveGate(p.id, d.approvals.at(-1)!.id, {decision:"approve",feedback:""});
  await adapter.advanceDemo(p.id);
  await adapter.advanceDemo(p.id);
  await adapter.advanceDemo(p.id);
  d = await adapter.getProject(p.id);
  assert.equal(d.approvals.at(-1)?.kind, "Final");
  await adapter.approveGate(p.id, d.approvals.at(-1)!.id, {decision:"approve",feedback:""});
  d = await adapter.getProject(p.id);
  assert.equal(d.project.status, "complete");
  assert.ok(d.project.stages.every((s) => s.status === "complete"));
  assert.equal(d.agents.length, 0);
  await adapter.archiveProject(p.id);
  assert.equal((await adapter.getProject(p.id)).project.archived, true);
});
test("pause preserves approval state and prevents approval while paused", async () => {
  const adapter = new MockStudioAdapter();
  await adapter.pauseRun("offscript");
  await assert.rejects(
    () => adapter.approveGate("offscript", "direction-offscript", {decision:"approve",feedback:""}),
    /no longer available/,
  );
  await adapter.resumeRun("offscript");
  assert.equal((await adapter.getRunStatus("offscript")).status, "waiting");
  await adapter.approveGate("offscript", "direction-offscript", {decision:"approve",feedback:""});
  await assert.rejects(
    () => adapter.approveGate("offscript", "direction-offscript", {decision:"approve",feedback:""}),
    /no longer available/,
  );
});
test("gate cannot be used by a different project and change requests require feedback", async () => {
  const adapter = new MockStudioAdapter();
  await assert.rejects(() =>
    adapter.approveGate("forma", "direction-offscript", {decision:"approve",feedback:""}),
  );
  await assert.rejects(
    () =>
      adapter.approveGate("offscript", "direction-offscript", {decision:"changes",feedback:" "}),
    /Add a note/,
  );
  await adapter.approveGate(
    "offscript",
    "direction-offscript", {decision:"changes",feedback:"More contrast"},
  );
  const detail = await adapter.getProject("offscript");
  assert.equal(detail.approvals[0].feedback, "More contrast");
  assert.equal(
    detail.approvals.filter((a) => a.status === "pending").length,
    1,
  );
});
test("cancel closes pending gates and disallows resuming a cancelled run", async () => {
  const adapter = new MockStudioAdapter();
  await adapter.cancelRun("offscript");
  const d = await adapter.getProject("offscript");
  assert.equal(d.project.status, "cancelled");
  assert.equal(d.approvals.filter((a) => a.status === "pending").length, 0);
  assert.equal(d.agents.length, 0);
  await assert.rejects(() => adapter.resumeRun("offscript"));
  await assert.rejects(() => adapter.updateContext("offscript", emptyContext));
});
test("blocked run cannot advance until explicitly resolved; pause restores blocked state", async () => {
  const adapter = new MockStudioAdapter();
  await adapter.pauseRun("kinfolk");
  await adapter.resumeRun("kinfolk");
  assert.equal((await adapter.getRunStatus("kinfolk")).status, "blocked");
  await assert.rejects(() => adapter.advanceDemo("kinfolk"));
  await adapter.resolveDemo("kinfolk");
  assert.equal((await adapter.getRunStatus("kinfolk")).status, "working");
  assert.equal(
    (await adapter.getProject("kinfolk")).review.issues.filter(
      (i) => i.severity === "blocker",
    ).length,
    0,
  );
});
test("project context, references, and assets persist after adapter restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "studio-test-"));
  try {
    const file = join(dir, "demo.json");
    const first = new MockStudioAdapter(file);
    const p = await first.createProject(input);
    await first.addAssets(p.id, [
      {
        name: "brand.pdf",
        mimeType: "application/pdf",
        size: 42,
        url: "/api/assets/test",
      },
    ]);
    await first.updateContext(p.id, {
      ...input.context,
      goals: "Build something useful.",
    });
    await first.startRun(p.id);
    const second = new MockStudioAdapter(file);
    const restored = await second.getProject(p.id);
    assert.equal(restored.project.context.goals, "Build something useful.");
    assert.deepEqual(restored.project.referenceIds, ["lib-forma"]);
    assert.equal(restored.artifacts[0].title, "brand.pdf");
    assert.equal(restored.project.status, "working");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("unknown project, unknown reference, and invalid actions fail safely", async () => {
  const adapter = new MockStudioAdapter();
  await assert.rejects(() => adapter.getProject("missing"));
  await assert.rejects(() =>
    adapter.createProject({ ...input, referenceIds: ["missing"] }),
  );
  await assert.rejects(() => adapter.archiveProject("forma"));
  await assert.rejects(() => adapter.startRun("forma"));
  await assert.rejects(() => adapter.addAssets("orbit", []));
});
