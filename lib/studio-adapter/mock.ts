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
import "./server-only";
import { StudioError } from "./errors";
export { StudioError } from "./errors";
import { toStudioArtifact } from "./artifact.server";
import { unavailableCapabilities } from "./capabilities";
import type { ApprovalInput, EventOptions, LibraryOptions, StudioReadiness, StudioProductionRun, StudioMedia } from "./types";
/** Demonstration behavior only. Replace this class, never reproduce this in the UI. */
export class MockStudioAdapter implements StudioAdapter {
  readonly mode = "mock" as const;
  readonly capabilities = Object.freeze({...unavailableCapabilities,
    canStartRun:true,canResumeRun:true,canPauseRun:true,canCancelRun:true,canApprove:true,
    canReadArtifacts:true,canReadLibrary:true,canCreateProject:true,canArchiveProject:true,
    canUpdateContext:true,canUploadMedia:true,canAdvanceDemo:true,
  });
  private state: DemoState;
  constructor(private file?: string, state?: DemoState) {
    this.state = state ?? (
      file && existsSync(file)
        ? JSON.parse(readFileSync(file, "utf8"))
        : createSeed());
    this.state = structuredClone(this.state);
    this.state.artifacts = this.state.artifacts.map(toStudioArtifact);
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
      ...structuredClone(p),
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
      mode: this.mode,
      capabilities: this.capabilities,
      projects: await this.getProjects(),
      agents: structuredClone(this.state.agents),
      approvals: structuredClone(this.state.approvals),
      events: structuredClone(this.state.events),
      library: structuredClone(this.state.library),
    };
  }
  async getProjects() {
    return this.state.projects.map((p) => { const {context: _context, referenceIds: _refs, ...summary} = this.view(p); return summary; });
  }
  async getAgents(projectId?: string) {
    if (projectId) this.raw(projectId);
    return structuredClone(this.state.agents.filter(a => !projectId || a.projectId === projectId));
  }
  async getEvents(id: string, options: EventOptions = {}) {
    this.raw(id);
    if (options.before && !Number.isFinite(Date.parse(options.before))) throw new StudioError("Invalid event cursor.");
    return structuredClone(this.state.events.filter(e => e.projectId === id && (!options.before || Date.parse(e.createdAt) < Date.parse(options.before)))
      .sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt)).slice(0,this.limit(options.limit)));
  }
  private limit(value = 100) {
    if (!Number.isInteger(value) || value < 1 || value > 1000) throw new StudioError("Limit must be between 1 and 1000.");
    return value;
  }
  async getArtifacts(id: string) {
    this.raw(id);
    return this.state.artifacts.filter((e) => e.projectId === id).map(toStudioArtifact);
  }
  async getIterations(id: string) {
    this.raw(id);
    return structuredClone(this.state.iterations.filter((e) => e.projectId === id));
  }
  async getLibrary(options: LibraryOptions = {}) {
    return structuredClone(this.state.library.filter(l => (!options.category || l.category === options.category) && (!options.query || `${l.name} ${l.description}`.toLowerCase().includes(options.query.toLowerCase()))).slice(0,this.limit(options.limit)));
  }
  async getStages(id: string) { return structuredClone(this.raw(id).stages); }
  async getApprovals(id: string) { this.raw(id); return structuredClone(this.state.approvals.filter(a=>a.projectId===id)); }
  async getReviews(id: string) { this.raw(id); return structuredClone(this.state.reviews.filter(r=>r.projectId===id)); }
  async getMedia(id: string): Promise<StudioMedia[]> {
    return (await this.getArtifacts(id)).filter((a): a is StudioMedia => a.uploaded === true && !!a.downloadUrl);
  }
  async getProductionRun(id: string): Promise<StudioProductionRun | null> {
    const p = this.raw(id);
    return p.status === "draft" ? null : {id:`mock-run-${id}`,projectId:id,status:p.status,stageId:p.stageId,startedAt:p.createdAt,updatedAt:p.updatedAt,mode:this.mode};
  }
  async getReadiness(id: string): Promise<StudioReadiness> {
    const p = this.raw(id);
    const blockers = (await this.getReviews(id)).flatMap(r=>r.issues.filter(i=>i.severity === "blocker"));
    const ready = p.status === "complete" && !blockers.length;
    return {projectId:id,status:blockers.length ? "blocked" : ready ? "ready" : "not-ready",clientReady:ready,blockers,
      summary:ready ? "Demo handoff approved. This is an illustrative result." : blockers.length ? "Demo content blockers remain." : "Demo production is not ready for handoff.",assessedAt:p.updatedAt,mode:this.mode};
  }
  async getRunStatus(id: string) {
    return this.view(this.raw(id));
  }
  async getProject(id: string) {
    const [project, agents, stages, productionRun, readiness, media, reviews, events, artifacts, iterations, approvals] = await Promise.all([
      this.getRunStatus(id), this.getAgents(id), this.getStages(id), this.getProductionRun(id),
      this.getReadiness(id), this.getMedia(id), this.getReviews(id), this.getEvents(id),
      this.getArtifacts(id), this.getIterations(id), this.getApprovals(id),
    ]);
    return {
      project, agents, stages, productionRun, readiness, media, reviews, events, artifacts, iterations, approvals,
      capabilities: this.capabilities,
      review: reviews[0] || {
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
      ...structuredClone(input),
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
        a.status = "cancelled";
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
    p.context = structuredClone(context);
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
      title: f.name,
      metadata: {demo:true},
      type: "Media",
      mimeType: f.mimeType,
      size: f.size,
      downloadUrl: f.url,
      createdAt: new Date().toISOString(),
      uploaded: true,
    }));
    const safeAssets = assets.map(toStudioArtifact);
    this.state.artifacts.push(...safeAssets);
    this.event(
      id,
      `${assets.length} client asset${assets.length === 1 ? "" : "s"} added`,
    );
    this.save(p);
    return structuredClone(safeAssets);
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
    input: ApprovalInput,
  ) {
    const { decision, feedback = "" } = input;
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
