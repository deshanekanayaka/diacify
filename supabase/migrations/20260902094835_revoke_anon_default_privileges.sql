-- Supabase pre-configures ALTER DEFAULT PRIVILEGES on the public schema
-- so that anon and authenticated automatically get full access to any
-- new table the instant CREATE TABLE runs — before a migration's own
-- GRANT statements ever execute. That's how `patients` ended up with a
-- full-CRUD grant for anon despite the previous migration only ever
-- granting to authenticated: RLS (to authenticated only) still blocked
-- anon at the row level, so nothing leaked, but the table-level gate
-- was never actually closed the way it was documented to be. See
-- BUGS.md.
--
-- Fixed at the root, not per-table: revoke anon's existing grant on
-- patients, and remove the default privilege for the postgres role
-- (the role migrations run as) so every future table created by a
-- migration starts closed to anon, requiring an explicit GRANT like
-- patients already has for authenticated.

revoke all on patients from anon;

alter default privileges for role postgres in schema public
  revoke all on tables from anon;
