PRAGMA foreign_keys=OFF;
--> statement-breakpoint
DROP TABLE IF EXISTS `product_price_history`;
--> statement-breakpoint
DROP TABLE IF EXISTS `product_variants`;
--> statement-breakpoint
DROP TABLE IF EXISTS `products`;
--> statement-breakpoint
DROP TABLE IF EXISTS `product_categories`;
--> statement-breakpoint
DROP TABLE IF EXISTS `sale_payments`;
--> statement-breakpoint
DROP TABLE IF EXISTS `sale_items`;
--> statement-breakpoint
DROP TABLE IF EXISTS `sales`;
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`barcode` text,
	`name` text NOT NULL,
	`type` text DEFAULT 'article' NOT NULL,
	`iva_enabled` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`track_inventory` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "products_sku_not_empty" CHECK(length(trim("products"."sku")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_uq` ON `products` (`sku`);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_barcode_uq` ON `products` (`barcode`);
--> statement-breakpoint
CREATE INDEX `products_status_idx` ON `products` (`status`);
--> statement-breakpoint
CREATE INDEX `products_type_idx` ON `products` (`type`);
--> statement-breakpoint
CREATE INDEX `products_name_idx` ON `products` (`name`);
--> statement-breakpoint
CREATE TABLE `price_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_lists_name_uq` ON `price_lists` (`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_lists_id_currency_uq` ON `price_lists` (`id`,`currency`);
--> statement-breakpoint
CREATE INDEX `price_lists_currency_status_idx` ON `price_lists` (`currency`,`status`);
--> statement-breakpoint
CREATE TABLE `price_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`price_list_id` text NOT NULL,
	`product_id` text NOT NULL,
	`price` numeric NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "price_list_items_price_non_negative" CHECK("price_list_items"."price" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_list_items_list_product_uq` ON `price_list_items` (`price_list_id`,`product_id`);
--> statement-breakpoint
CREATE INDEX `price_list_items_list_status_position_idx` ON `price_list_items` (`price_list_id`,`status`,`position`);
--> statement-breakpoint
CREATE INDEX `price_list_items_product_idx` ON `price_list_items` (`product_id`);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`price_list_id` text NOT NULL,
	`product_id` text NOT NULL,
	`old_price` numeric,
	`new_price` numeric NOT NULL,
	`currency` text NOT NULL,
	`changed_by` text,
	`changed_by_name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `price_history_list_product_created_idx` ON `price_history` (`price_list_id`,`product_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `price_history_product_created_idx` ON `price_history` (`product_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `product_components` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`component_product_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`component_product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "product_components_quantity_positive" CHECK("product_components"."quantity" > 0),
	CONSTRAINT "product_components_not_self" CHECK("product_components"."product_id" <> "product_components"."component_product_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_components_product_component_uq` ON `product_components` (`product_id`,`component_product_id`);
--> statement-breakpoint
CREATE INDEX `product_components_product_idx` ON `product_components` (`product_id`);
--> statement-breakpoint
CREATE INDEX `product_components_component_idx` ON `product_components` (`component_product_id`);
--> statement-breakpoint
-- Cada aliado existente recibe una lista propia con su misma moneda. Así se
-- cumple la FK compuesta (price_list_id, currency) desde el primer momento.
INSERT INTO `price_lists` (`id`, `name`, `currency`, `status`, `description`, `created_at`, `updated_at`)
SELECT
	'pl_' || `id`,
	'Lista ' || `name` || ' (' || substr(`id`, 1, 6) || ')',
	`currency`,
	'active',
	NULL,
	`created_at`,
	`updated_at`
FROM `partners`;
--> statement-breakpoint
CREATE TABLE `__new_partners` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`alias` text,
	`rif` text,
	`slug` text NOT NULL,
	`type` text NOT NULL,
	`currency` text NOT NULL,
	`price_list_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`profit_warehouse_code` text,
	`contact_name` text,
	`contact_phone` text,
	`contact_email` text,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`price_list_id`,`currency`) REFERENCES `price_lists`(`id`,`currency`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_partners` (
	`id`, `name`, `alias`, `rif`, `slug`, `type`, `currency`, `price_list_id`,
	`status`, `profit_warehouse_code`, `contact_name`, `contact_phone`,
	`contact_email`, `notes`, `created_at`, `updated_at`
)
SELECT
	`id`, `name`, `alias`, `rif`, `slug`, `type`, `currency`, 'pl_' || `id`,
	`status`, `profit_warehouse_code`, `contact_name`, `contact_phone`,
	`contact_email`, `notes`, `created_at`, `updated_at`
FROM `partners`;
--> statement-breakpoint
DROP TABLE `partners`;
--> statement-breakpoint
ALTER TABLE `__new_partners` RENAME TO `partners`;
--> statement-breakpoint
CREATE UNIQUE INDEX `partners_slug_unique` ON `partners` (`slug`);
--> statement-breakpoint
CREATE INDEX `partners_status_idx` ON `partners` (`status`);
--> statement-breakpoint
CREATE INDEX `partners_price_list_idx` ON `partners` (`price_list_id`);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`partner_name` text NOT NULL,
	`partner_rif` text,
	`price_list_id` text NOT NULL,
	`price_list_name` text NOT NULL,
	`currency` text NOT NULL,
	`usd_rate` numeric NOT NULL,
	`eur_rate` numeric NOT NULL,
	`rate_date` text NOT NULL,
	`rate_source` text DEFAULT 'bcv' NOT NULL,
	`subtotal_usd` numeric NOT NULL,
	`discount_usd` numeric NOT NULL,
	`iva_usd` numeric NOT NULL,
	`total_usd` numeric NOT NULL,
	`subtotal_eur` numeric NOT NULL,
	`discount_eur` numeric NOT NULL,
	`iva_eur` numeric NOT NULL,
	`total_eur` numeric NOT NULL,
	`subtotal_ves` numeric NOT NULL,
	`discount_ves` numeric NOT NULL,
	`iva_ves` numeric NOT NULL,
	`total_ves` numeric NOT NULL,
	`discount_type` text DEFAULT 'none' NOT NULL,
	`discount_value` numeric DEFAULT 0 NOT NULL,
	`sold_at` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`notes` text,
	`created_by` text,
	`created_by_name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`cancelled_at` integer,
	`cancelled_by` text,
	`cancelled_by_name` text,
	`cancel_reason` text,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`cancelled_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "sales_total_usd_identity" CHECK(round("sales"."total_usd", 2) = round("sales"."subtotal_usd" - "sales"."discount_usd" + "sales"."iva_usd", 2)),
	CONSTRAINT "sales_total_eur_identity" CHECK(round("sales"."total_eur", 2) = round("sales"."subtotal_eur" - "sales"."discount_eur" + "sales"."iva_eur", 2)),
	CONSTRAINT "sales_total_ves_identity" CHECK(round("sales"."total_ves", 2) = round("sales"."subtotal_ves" - "sales"."discount_ves" + "sales"."iva_ves", 2)),
	CONSTRAINT "sales_discount_non_negative" CHECK("sales"."discount_usd" >= 0 and "sales"."discount_eur" >= 0 and "sales"."discount_ves" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_id_partner_uq` ON `sales` (`id`,`partner_id`);
--> statement-breakpoint
CREATE INDEX `sales_partner_sold_idx` ON `sales` (`partner_id`,`sold_at`);
--> statement-breakpoint
CREATE INDEX `sales_partner_status_idx` ON `sales` (`partner_id`,`status`);
--> statement-breakpoint
CREATE INDEX `sales_price_list_idx` ON `sales` (`price_list_id`);
--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`sale_id` text NOT NULL,
	`product_id` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` numeric NOT NULL,
	`subtotal` numeric NOT NULL,
	`discount` numeric DEFAULT 0 NOT NULL,
	`iva_enabled` integer NOT NULL,
	`iva_rate` numeric NOT NULL,
	`iva` numeric NOT NULL,
	`total` numeric NOT NULL,
	`subtotal_ves` numeric NOT NULL,
	`discount_ves` numeric DEFAULT 0 NOT NULL,
	`iva_ves` numeric NOT NULL,
	`total_ves` numeric NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`sale_id`,`partner_id`) REFERENCES `sales`(`id`,`partner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sale_items_quantity_positive" CHECK("sale_items"."quantity" > 0),
	CONSTRAINT "sale_items_total_identity" CHECK(round("sale_items"."total", 2) = round("sale_items"."subtotal" - "sale_items"."discount" + "sale_items"."iva", 2)),
	CONSTRAINT "sale_items_total_ves_identity" CHECK(round("sale_items"."total_ves", 2) = round("sale_items"."subtotal_ves" - "sale_items"."discount_ves" + "sale_items"."iva_ves", 2))
);
--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`sale_id`,`position`);
--> statement-breakpoint
CREATE INDEX `sale_items_partner_product_idx` ON `sale_items` (`partner_id`,`product_id`);
--> statement-breakpoint
CREATE TABLE `sale_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_id` text NOT NULL,
	`sale_id` text NOT NULL,
	`currency` text NOT NULL,
	`amount` numeric NOT NULL,
	`amount_ves` numeric NOT NULL,
	`usd_rate` numeric NOT NULL,
	`eur_rate` numeric NOT NULL,
	`rate_date` text NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	`paid_at` integer NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`notes` text,
	`created_by` text,
	`created_by_name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`voided_at` integer,
	`voided_by` text,
	`voided_by_name` text,
	`void_reason` text,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`voided_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sale_id`,`partner_id`) REFERENCES `sales`(`id`,`partner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sale_payments_amount_positive" CHECK("sale_payments"."amount" > 0),
	CONSTRAINT "sale_payments_amount_ves_non_negative" CHECK("sale_payments"."amount_ves" >= 0)
);
--> statement-breakpoint
CREATE INDEX `sale_payments_sale_idx` ON `sale_payments` (`sale_id`,`paid_at`);
--> statement-breakpoint
CREATE INDEX `sale_payments_partner_idx` ON `sale_payments` (`partner_id`,`paid_at`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
