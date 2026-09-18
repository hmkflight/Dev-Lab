CREATE TABLE `bridge_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`source_artifact_id` text NOT NULL,
	`project_id` text NOT NULL,
	`mime_type` text NOT NULL,
	`bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bridge_artifacts_source` ON `bridge_artifacts` (`source_artifact_id`);--> statement-breakpoint
ALTER TABLE `bridge_commands` ADD `semantic_key` text;--> statement-breakpoint
ALTER TABLE `bridge_commands` ADD `execution_id` text;--> statement-breakpoint
ALTER TABLE `bridge_commands` ADD `process_id` integer;--> statement-breakpoint
ALTER TABLE `bridge_commands` ADD `progress_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bridge_commands_semantic` ON `bridge_commands` (`semantic_key`);