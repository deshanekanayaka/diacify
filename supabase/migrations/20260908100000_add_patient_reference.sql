-- ADR-038 decided *that* patients get a clinician-chosen `reference` (a
-- short label like a chart number, not a legal name); this migration
-- resolves the field's own rules, left open at the time: free text,
-- 1-40 characters, unique per clinician (catches an accidental
-- duplicate chart entry without needing a global identity scheme).
--
-- NOT NULL with no default, matching the `sex` migration's precedent:
-- per context/tasks.md (2026-09-07), hosted has no real clinician-entered
-- patient data yet, only local/test rows, so there is nothing to backfill.

alter table patients
  add column reference text not null,
  add constraint patients_reference_length
    check (char_length(reference) between 1 and 40);

-- Composite unique index, not a bare unique column: uniqueness is scoped
-- to one clinician's own patients, not global across every clinician.
create unique index idx_patients_clinician_id_reference
  on patients (clinician_id, reference);
