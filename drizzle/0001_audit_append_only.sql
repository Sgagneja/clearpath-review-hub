-- The audit trail is evidence. Once an event is written it must never change,
-- so the database itself refuses UPDATE, DELETE and TRUNCATE on audit_events,
-- no matter what the application code does.
--
-- Defence in depth: in production the app would also connect as a role that
-- only has INSERT/SELECT on this table, and only the schema owner (used for
-- migrations) could disable these triggers. See SECURITY.md.

CREATE OR REPLACE FUNCTION audit_events_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege',
          HINT = 'Record a new event instead of changing an existing one.';
END;
$$;
--> statement-breakpoint

CREATE TRIGGER audit_events_no_update_or_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_reject_mutation();
--> statement-breakpoint

CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_reject_mutation();
