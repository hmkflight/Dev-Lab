import "./server-only";
import { resolve } from "node:path";
import type { StudioAdapter } from "./types";
import type { DemoState } from "./seed";
import { MockStudioAdapter } from "./mock";
import { DevLabStudioAdapter, type DevLabConfig } from "./devlab.server";
import { StudioError } from "./errors";
export type AdapterEnvironment = DevLabConfig & { STUDIO_DATA_DIR?: string };
interface AdapterOptions { artifactTransport?: import("./artifact.server").ArtifactTransport; env?: AdapterEnvironment; mockState?: DemoState; persistence?: "file" | "memory"; }
let localAdapter: StudioAdapter | undefined;
/** One composition root. No-option calls reuse the local server adapter.
 * Hosted requests pass durable state explicitly, so isolates never own authoritative state. */
export function getStudioAdapter(options?: AdapterOptions): StudioAdapter {
  if (!options && localAdapter) return localAdapter;
  const env = options?.env ?? process.env;
  const mode = env.DEVLAB_ADAPTER_MODE?.trim() || "mock";
  let adapter: StudioAdapter;
  if (mode === "mock") adapter = new MockStudioAdapter(options?.persistence === "memory" ? undefined : resolve(env.STUDIO_DATA_DIR || ".studio", "demo-state.json"), options?.mockState);
  else if (mode === "devlab") adapter = new DevLabStudioAdapter(env,undefined,options?.artifactTransport);
  else throw new StudioError("Unsupported studio adapter mode. Choose mock or devlab.",503);
  if (!options && mode === "mock") localAdapter = adapter;
  return adapter;
}
/** Demo extensions remain outside the production contract and are capability gated. */
export function getMockAdapter(adapter: StudioAdapter): MockStudioAdapter {
  if (adapter.mode !== "mock" || !adapter.capabilities.canAdvanceDemo || !(adapter instanceof MockStudioAdapter)) throw new StudioError("Demo actions are unavailable.",409);
  return adapter;
}
