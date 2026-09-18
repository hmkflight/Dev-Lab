import type { D1Database } from "@cloudflare/workers-types";
import "../lib/studio-adapter/server-only";
import { StudioError } from "../lib/studio-adapter/errors";
import { getStudioAdapter, getMockAdapter, type AdapterEnvironment } from "../lib/studio-adapter/index.server";
import { createSeed } from "../lib/studio-adapter/seed";
export async function loadStudio(db: D1Database, env: AdapterEnvironment = {}) {
  if (env.DEVLAB_ADAPTER_MODE && env.DEVLAB_ADAPTER_MODE !== "mock") {
    const adapter = getStudioAdapter({env,persistence:"memory"});
    return {adapter, persistence: null};
  }
  await db.prepare("INSERT OR IGNORE INTO studio_state (id, revision, data) VALUES (1, 0, ?)").bind(JSON.stringify(createSeed())).run();
  const row = await db.prepare("SELECT revision, data FROM studio_state WHERE id = 1").first<{revision: number; data: string}>();
  if (!row) throw new Error("Studio storage unavailable");
  const adapter = getStudioAdapter({env,persistence:"memory",mockState:JSON.parse(row.data)});
  return { adapter, persistence: {async save() {
    const result = await db.prepare("UPDATE studio_state SET data = ?, revision = revision + 1 WHERE id = 1 AND revision = ?").bind(JSON.stringify(getMockAdapter(adapter).exportState()), row.revision).run();
    if (!result.meta.changes) throw new StudioError("The studio changed in another request. Refresh and try again.", 409);
  }}};
}
