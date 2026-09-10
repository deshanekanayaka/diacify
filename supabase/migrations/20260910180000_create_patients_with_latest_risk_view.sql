-- context/tasks.md's risk-sort/filter gap, resolved: PostgREST can embed a
-- patient's latest risk assessment for display (GET /api/patients already
-- does this), but it cannot order or filter *patients* by a nested child's
-- value - there is no way to ask Postgres for "patients ordered by their
-- newest visit's newest risk_score" without first collapsing that chain
-- into one row per patient. This view does exactly that collapsing,
-- nothing more.
--
-- One row per patient. LEFT JOIN LATERAL, not a plain join or DISTINCT ON:
-- visit_count is an aggregate over *all* of a patient's visits, while the
-- risk fields come from only their single most recent visit's most recent
-- assessment - two different aggregation scopes a plain GROUP BY or
-- DISTINCT ON can't express together in one pass.
--
-- Plain view, not materialized: a materialized view needs a refresh
-- schedule (pg_cron or a trigger) and could show a stale risk score right
-- after it's recorded - the wrong trade for a clinical tool. At this
-- project's scale a live view's per-request cost is not a real one.
--
-- security_invoker = true: without it, a view runs with its owner's
-- privileges and bypasses RLS on the tables it reads - exactly the
-- cross-tenant hole every other table in this schema is built to avoid
-- (patients.clinician_id RLS, and the join-based RLS on visits and
-- risk_assessments). With it, the view enforces RLS as the querying role,
-- same as querying those tables directly: a clinician still only ever
-- sees their own patients through it.
create view patients_with_latest_risk
  with (security_invoker = true) as
select
  p.id,
  p.reference,
  p.sex,
  p.created_at,
  vc.visit_count,
  lv.visit_date as last_visit_date,
  ra.risk_category,
  ra.risk_score,
  ra.low_confidence,
  ra.model_version,
  ra.created_at as risk_assessed_at
from patients p
left join lateral (
  -- count(*) with no group by always returns exactly one row (0 for no
  -- matches), so this can never make the left join produce a null here.
  select count(*) as visit_count
  from visits v
  where v.patient_id = p.id
) vc on true
left join lateral (
  select v.id, v.visit_date
  from visits v
  where v.patient_id = p.id
  order by v.visit_date desc, v.created_at desc, v.id desc
  limit 1
) lv on true
left join lateral (
  select a.risk_category, a.risk_score, a.low_confidence, a.model_version, a.created_at
  from risk_assessments a
  where a.visit_id = lv.id
  order by a.created_at desc
  limit 1
) ra on true;

-- A view gets no Data API access by default either - same reasoning as
-- 20260901202853's table grant. SELECT only: this view exists to read a
-- derived shape, never to write through.
grant select on patients_with_latest_risk to authenticated;

-- Mirrors 20260905105810's table-grant assertion, scoped to this one view
-- (relkind 'v') rather than extending that generic check - the two check
-- different object kinds for different tables/views as they're added, and
-- keeping this one beside the view it's about is more legible than a
-- distant edit to an unrelated migration.
do $$
declare
  offending text;
begin
  select string_agg(a.privilege_type, ', ' order by a.privilege_type)
    into offending
  from pg_class c
  cross join lateral aclexplode(c.relacl) a
  where c.relnamespace = 'public'::regnamespace
    and c.relname = 'patients_with_latest_risk'
    and c.relkind = 'v'
    and pg_get_userbyid(a.grantee) = 'authenticated'
    and a.privilege_type <> 'SELECT';

  if offending is not null then
    raise exception 'authenticated holds privileges on patients_with_latest_risk beyond SELECT: %', offending;
  end if;
end $$;

do $$
declare
  offending text;
begin
  select string_agg(a.privilege_type, ', ' order by a.privilege_type)
    into offending
  from pg_class c
  cross join lateral aclexplode(c.relacl) a
  where c.relnamespace = 'public'::regnamespace
    and c.relname = 'patients_with_latest_risk'
    and c.relkind = 'v'
    and pg_get_userbyid(a.grantee) = 'anon';

  if offending is not null then
    raise exception 'anon holds privileges on patients_with_latest_risk, should hold none: %', offending;
  end if;
end $$;
