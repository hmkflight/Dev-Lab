DROP INDEX `bridge_artifacts_source`;--> statement-breakpoint
ALTER TABLE `bridge_artifacts` ADD `representation` text DEFAULT 'original' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `bridge_artifacts_representation` ON `bridge_artifacts` (`source_artifact_id`,`representation`);