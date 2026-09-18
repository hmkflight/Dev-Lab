CREATE TABLE `bridge_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`command_type` text NOT NULL,
	`mode` text NOT NULL,
	`payload` text NOT NULL,
	`requested_by` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text NOT NULL,
	`claimed_by` text,
	`claimed_at` text,
	`claim_token` text,
	`lease_until` text,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`acknowledgment` text,
	`result` text,
	`error` text,
	`completed_at` text,
	`available_at` text NOT NULL,
	`history` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bridge_commands_idempotency` ON `bridge_commands` (`requested_by`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `bridge_runners` (
	`id` text PRIMARY KEY NOT NULL,
	`last_seen` text NOT NULL,
	`mode` text NOT NULL,
	`online` integer NOT NULL
);
