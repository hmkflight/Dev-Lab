import "../lib/studio-adapter/server-only";
import type { ProjectAction, StudioAdapter, StudioCapabilities } from "../lib/studio-adapter/types";
import { supportsAction } from "../lib/studio-adapter/capabilities";
import { StudioError } from "../lib/studio-adapter/errors";
import { getMockAdapter } from "../lib/studio-adapter/index.server";
export function requireCapability(adapter: StudioAdapter, capability: keyof StudioCapabilities) {
  if (!adapter.capabilities[capability]) throw new StudioError("This operation is unavailable for the active adapter.",501);
}
export async function performAction(adapter: StudioAdapter, id: string, action: ProjectAction) {
  if (!supportsAction(adapter.capabilities,action)) throw new StudioError("This action is unavailable for the active adapter.",501);
  if (action === "advance-demo") return getMockAdapter(adapter).advanceDemo(id);
  if (action === "resolve-demo") return getMockAdapter(adapter).resolveDemo(id);
  return ({start:()=>adapter.startRun(id),pause:()=>adapter.pauseRun(id),resume:()=>adapter.resumeRun(id),cancel:()=>adapter.cancelRun(id),archive:()=>adapter.archiveProject(id)})[action]();
}
