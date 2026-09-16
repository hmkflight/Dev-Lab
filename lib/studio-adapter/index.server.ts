import type { StudioAdapter } from "./types";
import { resolve } from "node:path";
import { MockStudioAdapter } from "./mock";
/** Replace ONLY this composition root with a DevLabStudioAdapter. Keep secrets here. */
export const studioAdapter: StudioAdapter = new MockStudioAdapter(
  resolve(process.env.STUDIO_DATA_DIR || ".studio", "demo-state.json"),
);
