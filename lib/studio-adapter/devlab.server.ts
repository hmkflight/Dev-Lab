import "./server-only";
import type { StudioAdapter } from "./types";
import { unavailableCapabilities } from "./capabilities";
import { DevLabAdapterNotConfiguredError } from "./errors";
/** Server-only configuration placeholders. No network, filesystem, or process access. */
export interface DevLabConfig {
  DEVLAB_ROOT?: string;
  DEVLAB_API_URL?: string;
  DEVLAB_SUPABASE_URL?: string;
  DEVLAB_ADAPTER_MODE?: string;
}
export class DevLabStudioAdapter implements StudioAdapter {
  readonly mode = "devlab" as const;
  readonly capabilities = unavailableCapabilities;
  constructor(private readonly config: DevLabConfig = {}) {}
  private async unavailable(): Promise<never> { throw new DevLabAdapterNotConfiguredError(); }
  getSnapshot: StudioAdapter["getSnapshot"] = (..._args) => this.unavailable();
  createProject: StudioAdapter["createProject"] = (..._args) => this.unavailable();
  startRun: StudioAdapter["startRun"] = (..._args) => this.unavailable();
  getProjects: StudioAdapter["getProjects"] = (..._args) => this.unavailable();
  getProject: StudioAdapter["getProject"] = (..._args) => this.unavailable();
  getRunStatus: StudioAdapter["getRunStatus"] = (..._args) => this.unavailable();
  getStages: StudioAdapter["getStages"] = (..._args) => this.unavailable();
  getAgents: StudioAdapter["getAgents"] = (..._args) => this.unavailable();
  getProductionRun: StudioAdapter["getProductionRun"] = (..._args) => this.unavailable();
  getEvents: StudioAdapter["getEvents"] = (..._args) => this.unavailable();
  getArtifacts: StudioAdapter["getArtifacts"] = (..._args) => this.unavailable();
  getIterations: StudioAdapter["getIterations"] = (..._args) => this.unavailable();
  getApprovals: StudioAdapter["getApprovals"] = (..._args) => this.unavailable();
  getReviews: StudioAdapter["getReviews"] = (..._args) => this.unavailable();
  getReadiness: StudioAdapter["getReadiness"] = (..._args) => this.unavailable();
  getMedia: StudioAdapter["getMedia"] = (..._args) => this.unavailable();
  getLibrary: StudioAdapter["getLibrary"] = (..._args) => this.unavailable();
  approveGate: StudioAdapter["approveGate"] = (..._args) => this.unavailable();
  pauseRun: StudioAdapter["pauseRun"] = (..._args) => this.unavailable();
  resumeRun: StudioAdapter["resumeRun"] = (..._args) => this.unavailable();
  cancelRun: StudioAdapter["cancelRun"] = (..._args) => this.unavailable();
  archiveProject: StudioAdapter["archiveProject"] = (..._args) => this.unavailable();
  updateContext: StudioAdapter["updateContext"] = (..._args) => this.unavailable();
  addAssets: StudioAdapter["addAssets"] = (..._args) => this.unavailable();
}
