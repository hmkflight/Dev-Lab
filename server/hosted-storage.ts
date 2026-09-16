import type { D1Database } from "@cloudflare/workers-types";
import { MockStudioAdapter, StudioError } from "../lib/studio-adapter/mock";
import { createSeed } from "../lib/studio-adapter/seed";
export async function loadStudio(db: D1Database) {
  await db.prepare("INSERT OR IGNORE INTO studio_state (id, revision, data) VALUES (1, 0, ?)").bind(JSON.stringify(createSeed())).run();
  const row = await db.prepare("SELECT revision, data FROM studio_state WHERE id = 1").first<{revision: number; data: string}>();
  if (!row) throw new Error("Studio storage unavailable");
  const adapter = new MockStudioAdapter(undefined, JSON.parse(row.data));
  return { adapter, async save() {
    const result = await db.prepare("UPDATE studio_state SET data = ?, revision = revision + 1 WHERE id = 1 AND revision = ?").bind(JSON.stringify(adapter.exportState()), row.revision).run();
    if (!result.meta.changes) throw new StudioError("The studio changed in another request. Refresh and try again.", 409);
  }};
}
