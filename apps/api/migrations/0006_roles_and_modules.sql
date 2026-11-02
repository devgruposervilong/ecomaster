PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`email` text NOT NULL,
	`partner_id` text,
	`role` text NOT NULL,
	`module_access` text DEFAULT '[]' NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`revoked_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_invites`("id", "token_hash", "email", "partner_id", "role", "module_access", "expires_at", "used_at", "revoked_at", "created_by", "created_at") SELECT "id", "token_hash", "email", "partner_id", "role", '[]', "expires_at", "used_at", "revoked_at", "created_by", "created_at" FROM `invites`;--> statement-breakpoint
DROP TABLE `invites`;--> statement-breakpoint
ALTER TABLE `__new_invites` RENAME TO `invites`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_hash_unique` ON `invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `invites_email_idx` ON `invites` (`email`);--> statement-breakpoint
CREATE INDEX `invites_partner_idx` ON `invites` (`partner_id`);--> statement-breakpoint
CREATE INDEX `invites_expires_idx` ON `invites` (`expires_at`);--> statement-breakpoint
ALTER TABLE `user` ADD `module_access` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
-- El rol Operador se reemplaza por Coordinador del aliado. Conservamos el
-- acceso amplio de las cuentas existentes para no romper su operación.
DROP TRIGGER IF EXISTS `user_partner_required`;--> statement-breakpoint
UPDATE `user`
SET `role` = 'partner_coordinator',
    `module_access` = '["dashboard","sales","catalog","inventory","finance","reports","store"]'
WHERE `role` = 'partner_operator';--> statement-breakpoint
UPDATE `invites`
SET `role` = 'partner_coordinator',
    `module_access` = '["dashboard","sales","catalog","inventory","finance","reports","store"]'
WHERE `role` = 'partner_operator';--> statement-breakpoint
-- Los roles de aliado requieren aliado. Los roles globales (admin y
-- coordinador) no deben tener aliado asignado.
CREATE TRIGGER `user_partner_required`
BEFORE UPDATE OF `partner_id`, `role` ON `user`
WHEN (
	(NEW.`role` IN ('partner_admin', 'partner_coordinator') AND NEW.`partner_id` IS NULL)
	OR (NEW.`role` IN ('admin', 'coordinator') AND NEW.`partner_id` IS NOT NULL)
)
BEGIN
	SELECT RAISE(ABORT, 'invalid partner assignment for role');
END;