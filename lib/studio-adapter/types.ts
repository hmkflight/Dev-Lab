export type Extensible<T extends string> = T | (string & {});
export type StudioMode = "mock" | "devlab";
/** Transport-safe Dev Lab views. The backend owns all state and capabilities. */
export interface StudioStage {
  id: string;
  name: string;
  status: Extensible<"pending" | "active" | "complete" | "blocked">;
}
export type ProjectStatus = Extensible<
  | "draft"
  | "working"
  | "waiting"
  | "blocked"
  | "paused"
  | "complete"
  | "cancelled">;
export type ProjectAction =
  | "start"
  | "pause"
  | "resume"
  | "cancel"
  | "archive"
  | "advance-demo"
  | "resolve-demo";
export interface StudioContext {
  description: string;
  goals: string;
  audience: string;
  requirements: string;
  notes: string;
  links: string[];
  email: string;
  phone: string;
  address: string;
  socials: string;
  anythingElse: string;
}
export interface StudioProject {
  id: string;
  name: string;
  industry: string;
  summary: string;
  status: ProjectStatus;
  stageId: string;
  stages: StudioStage[];
  agentId?: string;
  createdAt: string;
  updatedAt: string;
  theme: string;
  websiteUrl?: string;
  previewUrl?: string;
  screenshotUrl?: string;
  context: StudioContext;
  archived: boolean;
  referenceIds: string[];
  actions: ProjectAction[];
}
export interface StudioAgent {
  id: string;
  name: string;
  role: string;
  status: Extensible<"idle" | "working" | "waiting" | "blocked" | "complete">;
  task: string;
  projectId?: string;
  latestResult: string;
  initials: string;
  color: string;
}
export interface StudioArtifact {
  id: string;
  projectId: string;
  title: string;
  type: string;
  previewUrl?: string;
  downloadUrl?: string;
  metadata: Record<string, string | number | boolean | null>;
  content?: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
  uploaded?: boolean;
}
export interface StudioEvent {
  id: string;
  projectId: string;
  message: string;
  agentName?: string;
  createdAt: string;
  details?: string;
}
export interface StudioApproval {
  id: string;
  projectId: string;
  title: string;
  description: string;
  kind: string;
  status: Extensible<"pending" | "approved" | "changes-requested" | "cancelled">;
  createdAt: string;
  resolvedAt?: string;
  feedback?: string;
}
export interface StudioIteration {
  id: string;
  projectId: string;
  name: string;
  summary: string;
  createdAt: string;
  previewUrl: string;
  status: string;
}
export interface StudioReview {
  projectId: string;
  categories: {
    id: string;
    name: string;
    value: string;
    status: "pass" | "warning" | "fail";
  }[];
  issues: StudioQAFinding[];
}
export interface StudioLibraryItem {
  id: string;
  name: string;
  category: string;
  style: string;
  industry: string;
  createdAt: string;
  previewUrl?: string;
  theme: string;
  description: string;
}
export interface ProjectInput {
  name: string;
  industry: string;
  context: StudioContext;
  referenceIds: string[];
}
export interface ProjectDetail {
  project: StudioProject;
  agents: StudioAgent[];
  events: StudioEvent[];
  artifacts: StudioArtifact[];
  iterations: StudioIteration[];
  approvals: StudioApproval[];
  review: StudioReview;
  reviews: StudioReview[];
  stages: StudioStage[];
  productionRun: StudioProductionRun | null;
  readiness: StudioReadiness;
  media: StudioMedia[];
  capabilities: StudioCapabilities;
}
export interface StudioSnapshot {
  mode: StudioMode;
  capabilities: StudioCapabilities;
  projects: StudioProjectSummary[];
  agents: StudioAgent[];
  approvals: StudioApproval[];
  events: StudioEvent[];
  library: StudioLibraryItem[];
}
export interface UploadInput {
  name: string;
  mimeType: string;
  size: number;
  url: string;
}
/** Implement on the server. No browser imports of a concrete adapter. */
export interface StudioAdapter {
  readonly mode: StudioMode;
  readonly capabilities: StudioCapabilities;
  getStages(id: string): Promise<StudioStage[]>;
  getProductionRun(id: string): Promise<StudioProductionRun | null>;
  getApprovals(id: string): Promise<StudioApproval[]>;
  getReviews(id: string): Promise<StudioReview[]>;
  getReadiness(id: string): Promise<StudioReadiness>;
  getMedia(id: string): Promise<StudioMedia[]>;
  getSnapshot(): Promise<StudioSnapshot>;
  createProject(input: ProjectInput): Promise<StudioProject>;
  startRun(id: string): Promise<StudioProject>;
  getProjects(): Promise<StudioProjectSummary[]>;
  getProject(id: string): Promise<ProjectDetail>;
  getRunStatus(id: string): Promise<StudioProject>;
  getAgents(projectId?: string): Promise<StudioAgent[]>;
  getEvents(id: string, options?: EventOptions): Promise<StudioEvent[]>;
  getArtifacts(id: string): Promise<StudioArtifact[]>;
  getIterations(id: string): Promise<StudioIteration[]>;
  approveGate(
    projectId: string,
    gateId: string,
    input: ApprovalInput,
  ): Promise<void>;
  pauseRun(id: string): Promise<StudioProject>;
  resumeRun(id: string): Promise<StudioProject>;
  cancelRun(id: string): Promise<StudioProject>;
  archiveProject(id: string): Promise<StudioProject>;
  updateContext(id: string, context: StudioContext): Promise<StudioProject>;
  addAssets(id: string, files: UploadInput[]): Promise<StudioArtifact[]>;
  getLibrary(options?: LibraryOptions): Promise<StudioLibraryItem[]>;
}

/** Lightweight dashboard view: client intake remains in project detail only. */
export type StudioProjectSummary = Omit<StudioProject, "context" | "referenceIds">;
export interface StudioProductionRun {
  id: string;
  projectId: string;
  status: Extensible<"working" | "waiting" | "blocked" | "paused" | "complete" | "cancelled">;
  stageId: string;
  startedAt: string;
  updatedAt: string;
  mode: StudioMode;
}
export interface StudioQAFinding {
  id: string;
  section: string;
  message: string;
  severity: Extensible<"blocker" | "warning" | "passed">;
  artifactId?: string;
}
export interface StudioReadiness {
  projectId: string;
  status: Extensible<"not-ready" | "blocked" | "ready" | "unknown">;
  clientReady: boolean;
  blockers: StudioQAFinding[];
  summary: string;
  assessedAt: string;
  mode: StudioMode;
}
export interface StudioMedia extends StudioArtifact {
  uploaded: true;
  downloadUrl: string;
}
export interface StudioCapabilities {
  readonly canStartRun: boolean;
  readonly canResumeRun: boolean;
  readonly canPauseRun: boolean;
  readonly canCancelRun: boolean;
  readonly canApprove: boolean;
  readonly canStreamEvents: boolean;
  readonly canReadArtifacts: boolean;
  readonly canControlAgents: boolean;
  readonly canReadLibrary: boolean;
  readonly canCreateProject: boolean;
  readonly canArchiveProject: boolean;
  readonly canUpdateContext: boolean;
  readonly canUploadMedia: boolean;
  readonly canAdvanceDemo: boolean;
}
export interface ApprovalInput { decision: "approve" | "changes"; feedback?: string; }
/** Newest first. `before` is an exclusive ISO timestamp; limit defaults to 100. */
export interface EventOptions { before?: string; limit?: number; }
export interface LibraryOptions { category?: string; query?: string; limit?: number; }
