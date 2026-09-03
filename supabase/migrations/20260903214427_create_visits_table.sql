-- The first table owned only transitively - a visit belongs to a patient,
-- not directly to a clinician. Ownership scoping therefore has to be a
-- join through patients, not a flat clinician_id column: a denormalized
-- clinician_id on visits would only secure the read path (foreign keys
-- don't respect RLS), since a clinician could still insert a visit whose
-- patient_id points at someone else's patient while satisfying their own
-- clinician_id check. The join-based policy below closes both paths with
-- one expression.
--
-- Facts only, deliberately - no risk_score/risk_category/top_factors
-- columns. Legacy combined raw measurements and model output on one row;
-- CLAUDE.md's facts-vs-judgements rule (do not combine them because it's
-- convenient) argues against that, and there's no Node-side ML inference
-- yet to populate those columns anyway. A future scoring table will
-- reference visits.id rather than growing this table's shape.
--
-- NOT NULL split matches legacy: the fields with ~0% real-world
-- missingness and direct model relevance (hba1c, age, bmi, systolic,
-- diastolic) are required. The rest (rbs, cholesterol, triglycerides,
-- hdl, ldl, vldl) are nullable - a clinician doesn't necessarily draw a
-- full lipid panel at every visit.

create table visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  visit_date date not null default current_date,
  age smallint not null,
  systolic numeric(5, 1) not null,
  diastolic numeric(5, 1) not null,
  bmi numeric(5, 2) not null,
  hba1c numeric(4, 2) not null,
  rbs numeric(6, 2),
  cholesterol numeric(6, 2),
  triglycerides numeric(6, 2),
  hdl numeric(6, 2),
  ldl numeric(6, 2),
  vldl numeric(6, 2),
  created_at timestamptz not null default now()
);

-- Legacy also had a lone idx_visits_patient_id, but that's redundant
-- here: this composite index's leading column already serves a
-- patient_id-only lookup (leftmost-prefix rule), so a second index would
-- just pay extra write I/O for a query the composite already covers.
create index idx_visits_patient_date on visits (patient_id, visit_date desc);

alter table visits enable row level security;

create policy "clinicians manage visits for their own patients"
  on visits
  for all
  to authenticated
  using (
    exists (
      select 1 from patients p
      where p.id = visits.patient_id
        and p.clinician_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from patients p
      where p.id = visits.patient_id
        and p.clinician_id = (select auth.uid())
    )
  );

-- anon has no default privilege on new tables at all - ADR-012 revoked
-- that at the role level for every future table, visits included. Only
-- an explicit GRANT to authenticated is needed here.
grant select, insert, update, delete on visits to authenticated;
