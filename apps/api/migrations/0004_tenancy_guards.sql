-- Un usuario que no sea admin no puede quedar sin aliado. El trigger corre en
-- las transiciones de rol/partner_id (no en el insert inicial de Better Auth,
-- que crea el usuario antes de que setup/accept le asigne el aliado).
CREATE TRIGGER `user_partner_required`
BEFORE UPDATE OF `partner_id`, `role` ON `user`
WHEN (NEW.`role` IS NULL OR NEW.`role` <> 'admin') AND NEW.`partner_id` IS NULL
BEGIN
	SELECT RAISE(ABORT, 'partner_id required for non-admin users');
END;
--> statement-breakpoint
-- La actividad del dashboard se consulta por aliado y se ordena por fecha.
CREATE INDEX `audit_logs_partner_created_idx` ON `audit_logs` (`partner_id`,`created_at`);
