CREATE TABLE `product_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_channels_product_channel_uq` ON `product_channels` (`product_id`,`channel_id`);--> statement-breakpoint
CREATE INDEX `product_channels_product_idx` ON `product_channels` (`product_id`);--> statement-breakpoint
CREATE INDEX `product_channels_channel_status_idx` ON `product_channels` (`channel_id`,`status`);