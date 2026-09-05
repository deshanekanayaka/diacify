-- ADR-012 closed this hole for anon and stopped there. authenticated has
-- carried TRUNCATE, REFERENCES, TRIGGER and MAINTAIN on every table since,
-- from Supabase's project-level default privileges rather than from any
-- migration - visible in pg_default_acl as `authenticated=Dxtm/postgres`
-- for tables created in public by postgres, which is how migrations run.
--
-- TRUNCATE is the one that matters. Every other write on these tables passes
-- two gates: the table grant, then the RLS policy deciding which rows the
-- caller may touch. TRUNCATE passes only the first, because it does not
-- operate on rows at all - so one statement would empty a table across every
-- clinician, with no second gate to stop it. Nothing can currently issue it
-- (PostgREST does not expose TRUNCATE, and authenticated is NOLOGIN so
-- nobody connects as it directly), which makes this a least-privilege fix
-- rather than an incident - but the absence of a route to a hole is not the
-- same as the hole being closed.
--
-- Written declaratively - revoke everything, grant back exactly what each
-- table needs - rather than subtracting the four stray privileges by name.
-- The end state then survives Supabase changing its defaults later, where a
-- list of things to remove would not.

revoke all on patients from authenticated;
revoke all on visits from authenticated;
revoke all on risk_assessments from authenticated;

grant select, insert, update, delete on patients to authenticated;
grant select, insert, update, delete on visits to authenticated;
-- Append-only, per ADR-028 and the BUGS.md entry that fixed it.
grant select, insert on risk_assessments to authenticated;

-- Future tables start closed, so a new migration must grant deliberately.
-- Forgetting now fails safe (no access) instead of silently over-granting.
alter default privileges for role postgres in schema public
  revoke all on tables from authenticated;

-- Assert the end state rather than trusting the statements above. This runs
-- wherever the migration runs, so a fresh database and the hosted project
-- are both checked, and it fails the migration rather than reporting later.
do $$
declare
  offending text;
begin
  select string_agg(format('%s:%s', table_name, privilege_type), ', ' order by table_name)
    into offending
  from information_schema.role_table_grants
  where grantee = 'authenticated'
    and table_schema = 'public'
    and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN');

  if offending is not null then
    raise exception 'authenticated still holds non-DML privileges: %', offending;
  end if;
end $$;
