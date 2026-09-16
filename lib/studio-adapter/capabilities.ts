import type { ProjectAction, StudioCapabilities } from "./types";
export const unavailableCapabilities: StudioCapabilities = Object.freeze({
  canStartRun:false,canResumeRun:false,canPauseRun:false,canCancelRun:false,
  canApprove:false,canStreamEvents:false,canReadArtifacts:false,canControlAgents:false,
  canReadLibrary:false,canCreateProject:false,canArchiveProject:false,
  canUpdateContext:false,canUploadMedia:false,canAdvanceDemo:false,
});
export function supportsAction(c: StudioCapabilities, action: ProjectAction): boolean {
  return c[({start:"canStartRun",resume:"canResumeRun",pause:"canPauseRun",cancel:"canCancelRun",archive:"canArchiveProject","advance-demo":"canAdvanceDemo","resolve-demo":"canAdvanceDemo"} as const)[action]];
}
