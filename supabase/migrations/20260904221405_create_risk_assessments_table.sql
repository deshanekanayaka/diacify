-- The judgement side of the facts/judgements split ADR-018 set up: visits
-- holds what was measured, this holds what a model concluded about it.
--
-- Append-only, one row per (visit, model version), rather than one
-- overwritten row per visit. A prediction is an event - what this model
-- concluded about this visit - not a property of the visit. Overwriting on
-- re-score would erase what the previous model said, which makes the stored
-- model_version decorative (it could only ever mean "the latest one") and
-- makes "did the retrain move anyone between categories" unanswerable.
--
-- The unique constraint also buys idempotency for free: scoring is
-- deterministic, so the same visit under the same model is always the same
-- answer, and a retried request collides instead of duplicating.
--
-- There is no 'pending' state, unlike legacy. Legacy needed one because its
-- ML service was a separate process that could be unreachable when a visit
-- was saved. Inference now runs in-process (ADR-001), so that failure mode
-- is gone and the absence of a row already means "not scored yet".

create type risk_category as enum ('low', 'medium', 'high');

create table risk_assessments (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits (id) on delete cascade,
  model_version text not null,
  -- double precision, not numeric(x, y): the Node traversal reproduces
  -- scikit-learn's float64 probabilities exactly, and a scaled numeric
  -- would quietly round that away on the way in. risk_score is different -
  -- it is already rounded to 2dp by the scoring rule itself.
  probability_low double precision not null,
  probability_medium double precision not null,
  probability_high double precision not null,
  risk_score numeric(5, 2) not null,
  risk_category risk_category not null,
  low_confidence boolean not null,
  created_at timestamptz not null default now(),
  unique (visit_id, model_version)
);

-- No separate index on visit_id: the unique constraint's index leads with
-- it, so a visit's assessments are already covered by the leftmost-prefix
-- rule - the same reason visits dropped legacy's redundant patient_id index.

alter table risk_assessments enable row level security;

-- Three levels of ownership, resolved in one expression. Nothing on this
-- row names a clinician, so as with visits (ADR-017) a denormalized owner
-- column would secure only the read path: a clinician could satisfy their
-- own id check while pointing visit_id at someone else's visit, because a
-- foreign key confirms the row exists without consulting RLS.
create policy "clinicians manage risk assessments for their own patients"
  on risk_assessments
  for all
  to authenticated
  using (
    exists (
      select 1 from visits v
      join patients p on p.id = v.patient_id
      where v.id = risk_assessments.visit_id
        and p.clinician_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from visits v
      join patients p on p.id = v.patient_id
      where v.id = risk_assessments.visit_id
        and p.clinician_id = (select auth.uid())
    )
  );

-- ADR-012 revoked anon's default privilege on new tables at the role level,
-- so only the explicit grant to authenticated is needed.
grant select, insert, update, delete on risk_assessments to authenticated;
