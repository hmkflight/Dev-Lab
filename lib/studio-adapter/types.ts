/** Transport-safe Dev Lab views. The backend owns all state and capabilities. */
export interface StudioStage {
  id: string;
  name: string;
  status: "pending" | "active" | "complete" | "blocked";
}
export type ProjectStatus =
  | "draft"
  | "working"
  | "waiting"
  | "blocked"
  | "paused"
  | "complete"
  | "cancelled";
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
  status: "idle" | "working" | "waiting" | "blocked" | "complete";
  task: string;
  projectId?: string;
  latestResult: string;
  initials: string;
  color: string;
}
export interface StudioArtifact {
  id: string;
  projectId: string;
  name: string;
  type: string;
  url?: string;
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
  status: "pending" | "approved" | "changes-requested";
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
  issues: {
    id: string;
    section: string;
    message: string;
    severity: "blocker" | "warning" | "passed";
  }[];
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
}
export interface StudioSnapshot {
  mode: "demo" | "live";
  projects: StudioProject[];
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
  getSnapshot(): Promise<StudioSnapshot>;
  createProject(input: ProjectInput): Promise<StudioProject>;
  startRun(id: string): Promise<StudioProject>;
  getProjects(): Promise<StudioProject[]>;
  getProject(id: string): Promise<ProjectDetail>;
  getRunStatus(id: string): Promise<StudioProject>;
  getAgents(): Promise<StudioAgent[]>;
  getEvents(id: string): Promise<StudioEvent[]>;
  getArtifacts(id: string): Promise<StudioArtifact[]>;
  getIterations(id: string): Promise<StudioIteration[]>;
  approveGate(
    projectId: string,
    gateId: string,
    decision: "approve" | "changes",
    feedback?: string,
  ): Promise<void>;
  pauseRun(id: string): Promise<StudioProject>;
  resumeRun(id: string): Promise<StudioProject>;
  cancelRun(id: string): Promise<StudioProject>;
  archiveProject(id: string): Promise<StudioProject>;
  updateContext(id: string, context: StudioContext): Promise<StudioProject>;
  addAssets(id: string, files: UploadInput[]): Promise<StudioArtifact[]>;
  getLibrary(): Promise<StudioLibraryItem[]>;
}
