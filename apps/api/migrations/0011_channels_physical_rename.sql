ALTER TABLE `price_lists` RENAME TO `channels`;
--> statement-breakpoint
ALTER TABLE `price_list_items` RENAME TO `channel_prices`;
--> statement-breakpoint
ALTER TABLE `channel_prices` RENAME COLUMN `price_list_id` TO `channel_id`;
--> statement-breakpoint
ALTER TABLE `price_history` RENAME COLUMN `price_list_id` TO `channel_id`;
--> statement-breakpoint
ALTER TABLE `partners` RENAME COLUMN `price_list_id` TO `channel_id`;
--> statement-breakpoint
ALTER TABLE `sales` RENAME COLUMN `price_list_id` TO `channel_id`;
--> statement-breakpoint
ALTER TABLE `sales` RENAME COLUMN `price_list_name` TO `channel_name`;
