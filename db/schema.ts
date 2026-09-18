import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";
export const studioState = sqliteTable("studio_state", {
  id: integer("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  data: text("data").notNull(),
});

// Bridge transport only. Never a copy of CPE production state.
export const bridgeCommands = sqliteTable('bridge_commands', {
  id:text('id').primaryKey(), project_id:text('project_id').notNull(), command_type:text('command_type').notNull(), mode:text('mode').notNull(), payload:text('payload').notNull(),
  requested_by:text('requested_by').notNull(), idempotency_key:text('idempotency_key').notNull(), fingerprint:text('fingerprint').notNull(),
  created_at:text('created_at').notNull(), status:text('status').notNull(), claimed_by:text('claimed_by'), claimed_at:text('claimed_at'), claim_token:text('claim_token'), lease_until:text('lease_until'),
  reconciliation:text('reconciliation'),reconciled_at:text('reconciled_at'),semantic_key:text('semantic_key'), execution_id:text('execution_id'), process_id:integer('process_id'), progress_at:text('progress_at'),
  attempt_count:integer('attempt_count').notNull().default(0), acknowledgment:text('acknowledgment'), result:text('result'), error:text('error'), completed_at:text('completed_at'), available_at:text('available_at').notNull(), history:text('history').notNull(),
},table=>[uniqueIndex('bridge_commands_idempotency').on(table.requested_by,table.idempotency_key),uniqueIndex('bridge_commands_semantic').on(table.semantic_key)]);
export const bridgeRunners = sqliteTable('bridge_runners',{id:text('id').primaryKey(),last_seen:text('last_seen').notNull(),mode:text('mode').notNull(),online:integer('online').notNull()});

export const bridgeArtifacts=sqliteTable("bridge_artifacts",{id:text("id").primaryKey(),source_artifact_id:text("source_artifact_id").notNull(),representation:text("representation").notNull().default("original"),project_id:text("project_id").notNull(),mime_type:text("mime_type").notNull(),bytes:integer("bytes").notNull(),sha256:text("sha256").notNull(),created_at:text("created_at").notNull()},t=>[uniqueIndex("bridge_artifacts_representation").on(t.source_artifact_id,t.representation)]);
