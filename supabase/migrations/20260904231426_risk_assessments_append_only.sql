-- Makes the append-only contract structural rather than a claim in a comment.
--
-- The original migration described this table as append-only, then granted
-- update and delete to authenticated behind a FOR ALL policy. RLS stopped
-- another clinician touching the row, but nothing stopped the owner
-- rewriting or erasing their own - so a stored risk_category recorded what
-- someone last decided it should say, not what the model concluded. That
-- undermines the whole reason assessments are kept per model version.
--
-- Both gates are closed, not just one: no UPDATE/DELETE policy exists and
-- the table-level privilege is revoked, the same defence-in-depth ADR-012
-- established after discovering a silently-open table grant.
--
-- Deleting a patient still removes their assessments: a foreign key cascade
-- runs as a referential-integrity action rather than as the caller's own
-- DELETE, so it does not consult this privilege. Covered by a test, since
-- that is an assumption worth proving rather than reasoning about.

drop policy "clinicians manage risk assessments for their own patients" on risk_assessments;

create policy "clinicians read risk assessments for their own patients"
  on risk_assessments
  for select
  to authenticated
  using (
    exists (
      select 1 from visits v
      join patients p on p.id = v.patient_id
      where v.id = risk_assessments.visit_id
        and p.clinician_id = (select auth.uid())
    )
  );

create policy "clinicians create risk assessments for their own patients"
  on risk_assessments
  for insert
  to authenticated
  with check (
    exists (
      select 1 from visits v
      join patients p on p.id = v.patient_id
      where v.id = risk_assessments.visit_id
        and p.clinician_id = (select auth.uid())
    )
  );

revoke update, delete on risk_assessments from authenticated;
