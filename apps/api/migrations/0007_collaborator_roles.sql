-- Renombra los roles de coordinación a colaboración sin perder sus permisos.
DROP TRIGGER IF EXISTS `user_partner_required`;--> statement-breakpoint
UPDATE `user`
SET `role` = 'collaborator'
WHERE `role` = 'coordinator';--> statement-breakpoint
UPDATE `user`
SET `role` = 'partner_collaborator'
WHERE `role` = 'partner_coordinator';--> statement-breakpoint
UPDATE `invites`
SET `role` = 'collaborator'
WHERE `role` = 'coordinator';--> statement-breakpoint
UPDATE `invites`
SET `role` = 'partner_collaborator'
WHERE `role` = 'partner_coordinator';--> statement-breakpoint
CREATE TRIGGER `user_partner_required`
BEFORE UPDATE OF `partner_id`, `role` ON `user`
WHEN (
	(NEW.`role` IN ('partner_admin', 'partner_collaborator') AND NEW.`partner_id` IS NULL)
	OR (NEW.`role` IN ('admin', 'collaborator') AND NEW.`partner_id` IS NOT NULL)
)
BEGIN
	SELECT RAISE(ABORT, 'invalid partner assignment for role');
END;
