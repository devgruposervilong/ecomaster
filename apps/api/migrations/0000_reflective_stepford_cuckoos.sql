CREATE TABLE `healthcheck` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`checked_at` text DEFAULT (datetime('now')) NOT NULL
);
