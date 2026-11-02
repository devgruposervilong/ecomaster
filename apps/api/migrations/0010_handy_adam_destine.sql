CREATE TABLE `wink_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`external_sale_id` text,
	`event` text DEFAULT 'unknown' NOT NULL,
	`payload_hash` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`error` text,
	`sale_id` text,
	`external_updated_at` integer,
	`signature_timestamp` integer,
	`ip_address` text,
	`user_agent` text,
	`processing_attempts` integer DEFAULT 0 NOT NULL,
	`received_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`processed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wink_webhook_events_payload_hash_uq` ON `wink_webhook_events` (`payload_hash`);--> statement-breakpoint
CREATE INDEX `wink_webhook_events_sale_idx` ON `wink_webhook_events` (`external_sale_id`,`external_updated_at`);--> statement-breakpoint
CREATE INDEX `wink_webhook_events_received_idx` ON `wink_webhook_events` (`received_at`);--> statement-breakpoint
CREATE INDEX `wink_webhook_events_status_idx` ON `wink_webhook_events` (`status`);