CREATE TABLE `__old_products` AS SELECT * FROM `products`;
--> statement-breakpoint
CREATE TABLE `__old_product_price_history` AS SELECT * FROM `product_price_history`;
--> statement-breakpoint
DROP TABLE `product_price_history`;
--> statement-breakpoint
DROP TABLE `products`;
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`description` text,
	`brand` text,
	`type` text DEFAULT 'product' NOT NULL,
	`variant_label` text DEFAULT 'Variante' NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`,`partner_id`) REFERENCES `product_categories`(`id`,`partner_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_id_partner_uq` ON `products` (`id`,`partner_id`);
--> statement-breakpoint
INSERT INTO `products` (
	`id`, `partner_id`, `category_id`, `name`, `description`, `brand`, `type`,
	`variant_label`, `currency`, `status`, `created_at`, `updated_at`
)
SELECT
	`id`, `partner_id`, `category_id`, `name`, `description`, NULL, 'product',
	'Variante', `currency`, `status`, `created_at`, `updated_at`
FROM `__old_products`;
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`product_id` text NOT NULL,
	`sku` text NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`price_cents` integer NOT NULL,
	`cost_cents` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`profit_code` text,
	`size_value` real,
	`size_unit` text,
	`package_type` text DEFAULT 'unit' NOT NULL,
	`units_per_package` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`track_inventory` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`product_id`,`partner_id`) REFERENCES `products`(`id`,`partner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "product_variants_price_non_negative" CHECK("product_variants"."price_cents" >= 0),
	CONSTRAINT "product_variants_cost_non_negative" CHECK("product_variants"."cost_cents" is null or "product_variants"."cost_cents" >= 0),
	CONSTRAINT "product_variants_units_positive" CHECK("product_variants"."units_per_package" is null or "product_variants"."units_per_package" > 0),
	CONSTRAINT "product_variants_size_positive" CHECK("product_variants"."size_value" is null or "product_variants"."size_value" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_id_partner_uq` ON `product_variants` (`id`,`partner_id`);
--> statement-breakpoint
INSERT INTO `product_variants` (
	`id`, `partner_id`, `product_id`, `sku`, `barcode`, `name`, `price_cents`,
	`cost_cents`, `status`, `profit_code`, `size_value`, `size_unit`, `package_type`,
	`units_per_package`, `position`, `is_default`, `track_inventory`, `created_at`,
	`updated_at`
)
SELECT
	'var_' || `id`, `partner_id`, `id`, `sku`, NULL, 'Unica', `price_cents`,
	NULL, `status`, `profit_code`, NULL, NULL, 'unit', NULL, 0, 1, 1,
	`created_at`, `updated_at`
FROM `__old_products`;
--> statement-breakpoint
CREATE TABLE `product_price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`old_price_cents` integer,
	`new_price_cents` integer NOT NULL,
	`old_currency` text,
	`new_currency` text NOT NULL,
	`changed_by` text,
	`changed_by_name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`product_id`,`partner_id`) REFERENCES `products`(`id`,`partner_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`,`partner_id`) REFERENCES `product_variants`(`id`,`partner_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `product_price_history` (
	`id`, `partner_id`, `product_id`, `variant_id`, `old_price_cents`,
	`new_price_cents`, `old_currency`, `new_currency`, `changed_by`,
	`changed_by_name`, `created_at`
)
SELECT
	`id`, `partner_id`, `product_id`, 'var_' || `product_id`, `old_price_cents`,
	`new_price_cents`, `old_currency`, `new_currency`, `changed_by`,
	`changed_by_name`, `created_at`
FROM `__old_product_price_history`;
--> statement-breakpoint
DROP TABLE `__old_product_price_history`;
--> statement-breakpoint
DROP TABLE `__old_products`;
--> statement-breakpoint
CREATE INDEX `products_partner_status_idx` ON `products` (`partner_id`,`status`);
--> statement-breakpoint
CREATE INDEX `products_partner_category_idx` ON `products` (`partner_id`,`category_id`);
--> statement-breakpoint
CREATE INDEX `products_partner_created_idx` ON `products` (`partner_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `products_partner_name_idx` ON `products` (`partner_id`,`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_partner_sku_uq` ON `product_variants` (`partner_id`,`sku`);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_partner_barcode_uq` ON `product_variants` (`partner_id`,`barcode`);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_product_name_uq` ON `product_variants` (`product_id`,`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_product_default_uq` ON `product_variants` (`product_id`) WHERE "product_variants"."is_default" = 1;
--> statement-breakpoint
CREATE INDEX `product_variants_partner_product_idx` ON `product_variants` (`partner_id`,`product_id`);
--> statement-breakpoint
CREATE INDEX `product_variants_partner_status_idx` ON `product_variants` (`partner_id`,`status`);
--> statement-breakpoint
CREATE INDEX `product_variants_partner_barcode_idx` ON `product_variants` (`partner_id`,`barcode`);
--> statement-breakpoint
CREATE INDEX `product_variants_partner_profit_idx` ON `product_variants` (`partner_id`,`profit_code`);
--> statement-breakpoint
CREATE INDEX `product_variant_price_history_partner_product_created_idx` ON `product_price_history` (`partner_id`,`product_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `product_variant_price_history_partner_variant_created_idx` ON `product_price_history` (`partner_id`,`variant_id`,`created_at`);
