CREATE TABLE `product_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_categories_partner_name_uq` ON `product_categories` (`partner_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `product_categories_id_partner_uq` ON `product_categories` (`id`,`partner_id`);--> statement-breakpoint
CREATE INDEX `product_categories_partner_idx` ON `product_categories` (`partner_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`category_id` text,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`profit_code` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`,`partner_id`) REFERENCES `product_categories`(`id`,`partner_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "products_price_positive" CHECK("products"."price_cents" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_partner_sku_uq` ON `products` (`partner_id`,`sku`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_id_partner_uq` ON `products` (`id`,`partner_id`);--> statement-breakpoint
CREATE INDEX `products_partner_status_idx` ON `products` (`partner_id`,`status`);--> statement-breakpoint
CREATE INDEX `products_partner_category_idx` ON `products` (`partner_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `products_partner_created_idx` ON `products` (`partner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `product_price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`product_id` text NOT NULL,
	`old_price_cents` integer,
	`new_price_cents` integer NOT NULL,
	`old_currency` text,
	`new_currency` text NOT NULL,
	`changed_by` text,
	`changed_by_name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`,`partner_id`) REFERENCES `products`(`id`,`partner_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_price_history_partner_product_created_idx` ON `product_price_history` (`partner_id`,`product_id`,`created_at`);
