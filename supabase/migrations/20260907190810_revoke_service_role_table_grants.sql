-- service_role bypasses RLS entirely (rolbypassrls = true) and is not used
-- for table access anywhere in this app - ADR-013's per-request client is
-- what queries patients/visits/risk_assessments, always as authenticated;
-- the only service_role use is backend/.env.test calling the Auth admin API
-- to delete test users, unrelated to table grants.
--
-- Confirmed directly against local Postgres that service_role already holds
-- no DML here (MAINTAIN/REFERENCES/TRIGGER/TRUNCATE only, from the platform
-- default ACL for objects created by the `postgres` role, the role every
-- migration runs as). The hosted project's platform default reportedly
-- grants service_role full DML on the same tables instead - a different
-- Postgres/Supabase version, not anything an earlier migration here did.
-- For a role that bypasses RLS, permissive-on-hosted is the wrong direction:
-- an admin script or background job written later, tested against
-- service_role locally, would hit "permission denied" and could easily be
-- "fixed" by broadening the grant on hosted, never suspecting local was the
-- correct state all along.
--
-- Pins the same locked-down state everywhere, the same way ADR-012 and
-- ADR-029 did for anon and authenticated: revoke everything, assert the ACL
-- ends up empty. service_role needs nothing here, so nothing is granted back.

revoke all on patients from service_role;
revoke all on visits from service_role;
revoke all on risk_assessments from service_role;

alter default privileges for role postgres in schema public
  revoke all on tables from service_role;

-- Assert the end state from the real ACL (aclexplode), not
-- information_schema - which cannot even see MAINTAIN, per the migration
-- that fixed that exact blind spot for authenticated (20260905105810).
do $$
declare
  offending text;
begin
  select string_agg(format('%s:%s', c.relname, a.privilege_type), ', '
                    order by c.relname, a.privilege_type)
    into offending
  from pg_class c
  cross join lateral aclexplode(c.relacl) a
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'p')
    and pg_get_userbyid(a.grantee) = 'service_role';

  if offending is not null then
    raise exception 'service_role holds table privileges it should not: %', offending;
  end if;
end $$;
