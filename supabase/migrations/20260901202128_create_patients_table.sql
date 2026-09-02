-- Patients table: the first domain entity, owned by the clinician who
-- created it. Ownership is enforced twice, deliberately: application
-- queries scope by clinician_id, and Postgres RLS enforces the same
-- boundary independently, so a query that forgets its WHERE clause still
-- can't leak another clinician's patients.

create table patients (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_patients_clinician_id on patients (clinician_id);

alter table patients enable row level security;

-- USING governs which existing rows are visible/targetable (SELECT,
-- UPDATE, DELETE); WITH CHECK governs which values a row is allowed to
-- end up with (INSERT, UPDATE) — without WITH CHECK a clinician could
-- reassign clinician_id to someone else's id on update. auth.uid() is
-- wrapped in a SELECT so Postgres evaluates it once per query, not once
-- per row.
create policy "clinicians manage their own patients"
  on patients
  for all
  to authenticated
  using (clinician_id = (select auth.uid()))
  with check (clinician_id = (select auth.uid()));
