-- Corrects the assertion added in 20260904233344, which could not see the
-- privilege it most needed to.
--
-- That check read information_schema.role_table_grants and listed MAINTAIN
-- among the privileges it looked for. role_table_grants implements the SQL
-- standard, and MAINTAIN is a Postgres 17 addition outside it, so the view
-- never reports it - confirmed by observing that service_role demonstrably
-- holds MAINTAIN (visible via aclexplode) while the view lists only seven
-- privilege kinds, none of them MAINTAIN. The assertion therefore checked
-- three privileges while reading as though it checked four.
--
-- Nothing was actually wrong with the grants: REVOKE ALL operates on the
-- real ACL rather than on information_schema, so MAINTAIN was already gone.
-- What was wrong was the check, which is the worse place for it - an
-- assertion is what you trust instead of looking.
--
-- Reads pg_class.relacl through aclexplode, which is the actual privilege
-- store. Also inverted from a blocklist to a subset check: rather than
-- naming privileges that must be absent, which only ever catches what
-- someone thought to list, it requires that authenticated holds nothing
-- beyond the intended set. That catches MAINTAIN, and whatever Postgres 18
-- adds, with no list to maintain - and it matches how the grants themselves
-- are written (revoke all, grant back exactly what is needed).
--
-- Note: relacl is NULL for a table carrying no explicit grants, and
-- aclexplode(NULL) returns no rows. A table nobody has been granted
-- anything on therefore passes trivially, which is the correct outcome.

do $$
declare
  offending text;
begin
  with intended (rel, priv) as (
    select 'patients', unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
    union all select 'visits', unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
    -- Append-only, per ADR-028.
    union all select 'risk_assessments', unnest(array['SELECT', 'INSERT'])
  )
  select string_agg(format('%s:%s', c.relname, a.privilege_type), ', '
                    order by c.relname, a.privilege_type)
    into offending
  from pg_class c
  cross join lateral aclexplode(c.relacl) a
  where c.relnamespace = 'public'::regnamespace
    and c.relkind in ('r', 'p')
    and pg_get_userbyid(a.grantee) = 'authenticated'
    and not exists (
      select 1 from intended i
      where i.rel = c.relname and i.priv = a.privilege_type
    );

  if offending is not null then
    raise exception 'authenticated holds privileges outside the intended set: %', offending;
  end if;
end $$;

-- anon should hold nothing at all on an application table (ADR-012). Checked
-- from the ACL for the same reason as above.
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
    and pg_get_userbyid(a.grantee) = 'anon';

  if offending is not null then
    raise exception 'anon holds table privileges it should not: %', offending;
  end if;
end $$;
