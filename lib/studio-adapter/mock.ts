import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { createSeed, stagesAt, type DemoState } from "./seed";
import type {
  StudioAdapter,
  StudioProject,
  ProjectInput,
  StudioContext,
  UploadInput,
} from "./types";
export class StudioError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
/** Demonstration behavior only. Replace this class, never reproduce this in the UI. */
export class MockStudioAdapter implements StudioAdapter {
  private state: DemoState;
  constructor(private file?: string, state?: DemoState) {
    this.state = state ?? (
      file && existsSync(file)
        ? JSON.parse(readFileSync(file, "utf8"))
        : createSeed());
    this.persist();
  }
  exportState(): DemoState { return structuredClone(this.state); }
  private persist() {
    if (this.file) {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(`${this.file}.tmp`, JSON.stringify(this.state, null, 2));
      renameSync(`${this.file}.tmp`, this.file);
    }
  }
  private raw(id: string) {
    const p = this.state.projects.find((p) => p.id === id);
    if (!p) throw new StudioError("Project not found.", 404);
    return p;
  }
  private view(p: StudioProject): StudioProject {
    return {
      ...p,
      actions: p.archived
        ? []
        : p.status === "draft"
          ? ["start", "cancel"]
          : p.status === "complete" || p.status === "cancelled"
            ? ["archive"]
            : p.status === "paused"
              ? ["resume", "cancel"]
              : p.status === "working"
                ? ["pause", "cancel", "advance-demo"]
                : p.status === "blocked"
                  ? ["pause", "cancel", "resolve-demo"]
                  : ["pause", "cancel"],
    };
  }
  private ensure(id: string, action: string) {
    const p = this.raw(id);
    if (!this.view(p).actions.includes(action as never))
      throw new StudioError(
        "This action is not available in the current project state.",
        409,
      );
    return p;
  }
  private event(id: string, message: string, details?: string) {
    this.state.events.unshift({
      id: randomUUID(),
      projectId: id,
      message,
      createdAt: new Date().toISOString(),
      details:
        details ||
        "Explicit demo action. No external Dev Lab process was executed.",
    });
  }
  private save(p: StudioProject) {
    p.updatedAt = new Date().toISOString();
    this.persist();
    return this.view(p);
  }
  private releaseAgents(id: string) {
    this.state.agents
      .filter((a) => a.projectId === id)
      .forEach((a) => {
        a.status = "idle";
        a.task = "Ready for the next project";
        a.latestResult = "Demo assignment finished";
        delete a.projectId;
      });
  }
  private assign(p: StudioProject) {
    const a =
      this.state.agents.find(
        (a) => a.id === p.agentId && a.projectId === p.id,
      ) || this.state.agents.find((a) => a.status === "idle");
    if (a) {
      a.projectId = p.id;
      a.status = "working";
      a.task = `Working on ${p.stageId}`;
      p.agentId = a.id;
    } else delete p.agentId;
  }
  async getSnapshot() {
    return {
      mode: "demo" as const,
      projects: await this.getProjects(),
      agents: this.state.agents,
      approvals: this.state.approvals,
      events: this.state.events,
      library: this.state.library,
    };
  }
  async getProjects() {
    return this.state.projects.map((p) => this.view(p));
  }
  async getAgents() {
    return this.state.agents;
  }
  async getEvents(id: string) {
    this.raw(id);
    return this.state.events.filter((e) => e.projectId === id);
  }
  async getArtifacts(id: string) {
    this.raw(id);
    return this.state.artifacts.filter((e) => e.projectId === id);
  }
  async getIterations(id: string) {
    this.raw(id);
    return this.state.iterations.filter((e) => e.projectId === id);
  }
  async getLibrary() {
    return this.state.library;
  }
  async getRunStatus(id: string) {
    return this.view(this.raw(id));
  }
  async getProject(id: string) {
    return {
      project: await this.getRunStatus(id),
      agents: this.state.agents.filter((a) => a.projectId === id),
      events: await this.getEvents(id),
      artifacts: await this.getArtifacts(id),
      iterations: await this.getIterations(id),
      approvals: this.state.approvals.filter((a) => a.projectId === id),
      review: this.state.reviews.find((r) => r.projectId === id) || {
        projectId: id,
        categories: [],
        issues: [],
      },
    };
  }
  async createProject(input: ProjectInput) {
    if (
      input.referenceIds.some(
        (id) => !this.state.library.some((l) => l.id === id),
      )
    )
      throw new StudioError("A selected reference no longer exists.");
    const now = new Date().toISOString();
    const p: StudioProject = {
      ...input,
      id: randomUUID(),
      summary: input.context.description || "A new story starts here.",
      theme: "forma",
      status: "draft",
      stageId: "intake",
      stages: stagesAt(0),
      createdAt: now,
      updatedAt: now,
      archived: false,
      actions: [],
    };
    this.state.projects.unshift(p);
    this.event(p.id, "Client context saved");
    return this.save(p);
  }
  async startRun(id: string) {
    const p = this.ensure(id, "start");
    p.status = "working";
    p.stageId = "research";
    p.stages = stagesAt(1);
    this.assign(p);
    this.event(id, "Demo factory started — research is active");
    return this.save(p);
  }
  async pauseRun(id: string) {
    const p = this.ensure(id, "pause");
    this.state.pausedStatuses[id] = p.status;
    p.status = "paused";
    this.state.agents
      .filter((a) => a.projectId === id)
      .forEach((a) => (a.status = "waiting"));
    this.event(id, "Project paused");
    return this.save(p);
  }
  async resumeRun(id: string) {
    const p = this.ensure(id, "resume");
    p.status = this.state.pausedStatuses[id] || "working";
    delete this.state.pausedStatuses[id];
    this.state.agents
      .filter((a) => a.projectId === id)
      .forEach(
        (a) =>
          (a.status =
            p.status === "working"
              ? "working"
              : p.status === "blocked"
                ? "blocked"
                : "waiting"),
      );
    this.event(id, "Project resumed");
    return this.save(p);
  }
  async cancelRun(id: string) {
    const p = this.ensure(id, "cancel");
    p.status = "cancelled";
    this.releaseAgents(id);
    delete p.agentId;
    this.state.approvals
      .filter((a) => a.projectId === id && a.status === "pending")
      .forEach((a) => {
        a.status = "changes-requested";
        a.feedback = "Run cancelled";
        a.resolvedAt = new Date().toISOString();
      });
    this.event(id, "Run cancelled");
    return this.save(p);
  }
  async archiveProject(id: string) {
    const p = this.ensure(id, "archive");
    p.archived = true;
    this.event(id, "Project archived");
    return this.save(p);
  }
  async updateContext(id: string, context: StudioContext) {
    const p = this.raw(id);
    if (p.archived || ["cancelled", "complete"].includes(p.status))
      throw new StudioError(
        "Context is read-only for a finished project.",
        409,
      );
    p.context = context;
    this.event(id, "Client context updated");
    return this.save(p);
  }
  async addAssets(id: string, files: UploadInput[]) {
    const p = this.raw(id);
    if (p.archived || ["cancelled", "complete"].includes(p.status))
      throw new StudioError("Uploads are closed for this project.", 409);
    const assets = files.map((f) => ({
      id: randomUUID(),
      projectId: id,
      name: f.name,
      type: "Media",
      mimeType: f.mimeType,
      size: f.size,
      url: f.url,
      createdAt: new Date().toISOString(),
      uploaded: true,
    }));
    this.state.artifacts.push(...assets);
    this.event(
      id,
      `${assets.length} client asset${assets.length === 1 ? "" : "s"} added`,
    );
    this.save(p);
    return assets;
  }
  private gate(p: StudioProject, kind: string) {
    p.status = "waiting";
    this.state.approvals.push({
      id: randomUUID(),
      projectId: p.id,
      title: `${kind} approval required`,
      description:
        kind === "Final"
          ? "Review the website and quality report before marking the project complete."
          : `Review the ${kind.toLowerCase()} before the demo moves to the next stage.`,
      kind,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    this.state.agents
      .filter((a) => a.projectId === p.id)
      .forEach((a) => (a.status = "waiting"));
    this.event(p.id, `Waiting for your ${kind.toLowerCase()} approval`);
  }
  async advanceDemo(id: string) {
    const p = this.ensure(id, "advance-demo");
    const i = p.stages.findIndex((s) => s.id === p.stageId);
    const next = Math.min(i + 1, p.stages.length - 1);
    p.stages.forEach(
      (s, n) =>
        (s.status = n < next ? "complete" : n === next ? "active" : "pending"),
    );
    p.stageId = p.stages[next].id;
    if (next >= 2) {
      p.previewUrl = "/previews/forma.html";
      p.websiteUrl = p.previewUrl;
      if (!this.state.iterations.some((it) => it.projectId === id))
        this.state.iterations.push({
          id: randomUUID(),
          projectId: id,
          name: "Demo concept",
          summary: "Illustrative demo output, independent of client context.",
          createdAt: new Date().toISOString(),
          previewUrl: p.previewUrl,
          status: "Current",
        });
    }
    this.event(id, `Demo advanced to ${p.stages[next].name}`);
    if (["concept", "design", "ready"].includes(p.stageId))
      this.gate(
        p,
        p.stageId === "ready"
          ? "Final"
          : p.stageId === "concept"
            ? "Direction"
            : "Build",
      );
    if (
      p.stageId === "qa" &&
      !this.state.reviews.some((r) => r.projectId === id)
    )
      this.state.reviews.push({
        projectId: id,
        categories: [
          { id: "demo", name: "Demo review", value: "Pass", status: "pass" },
        ],
        issues: [
          {
            id: "sample",
            section: "Demo website",
            message:
              "Illustrative result only. Real QA is supplied by Dev Lab.",
            severity: "passed",
          },
        ],
      });
    return this.save(p);
  }
  async resolveDemo(id: string) {
    const p = this.ensure(id, "resolve-demo");
    p.status = "working";
    p.context.notes = "Demo content marked as supplied by the studio owner.";
    const review = this.state.reviews.find((r) => r.projectId === id);
    if (review) {
      review.categories.forEach((c) => {
        if (c.status === "fail") {
          c.status = "pass";
          c.value = "Pass";
        }
      });
      review.issues.forEach((i) => {
        if (i.severity === "blocker") {
          i.severity = "passed";
          i.message = "Marked supplied for the demo workflow.";
        }
      });
    }
    this.assign(p);
    this.event(id, "Missing content marked supplied — demo only");
    return this.save(p);
  }
  async approveGate(
    projectId: string,
    gateId: string,
    decision: "approve" | "changes",
    feedback = "",
  ) {
    const p = this.raw(projectId);
    const gate = this.state.approvals.find(
      (a) => a.id === gateId && a.projectId === projectId,
    );
    if (
      !gate ||
      gate.status !== "pending" ||
      p.status !== "waiting" ||
      p.archived
    )
      throw new StudioError(
        "This approval is no longer available. Refresh the project.",
        409,
      );
    if (decision === "changes" && !feedback.trim())
      throw new StudioError("Add a note describing the requested changes.");
    if (
      decision === "approve" &&
      gate.kind === "Final" &&
      this.state.reviews
        .find((r) => r.projectId === projectId)
        ?.issues.some((i) => i.severity === "blocker")
    )
      throw new StudioError("Resolve QA blockers before final approval.", 409);
    gate.status = decision === "approve" ? "approved" : "changes-requested";
    gate.feedback = feedback;
    gate.resolvedAt = new Date().toISOString();
    if (decision === "changes") {
      p.status = "working";
      this.assign(p);
      this.event(projectId, `Changes requested: ${feedback}`);
      this.gate(p, gate.kind);
    } else if (gate.kind === "Final") {
      p.status = "complete";
      p.stages.forEach((s) => (s.status = "complete"));
      this.releaseAgents(projectId);
      delete p.agentId;
      this.event(projectId, "Final website approved — project complete");
    } else {
      p.status = "working";
      this.assign(p);
      this.event(projectId, `${gate.kind} approved — ready to continue`);
    }
    this.save(p);
  }
}
