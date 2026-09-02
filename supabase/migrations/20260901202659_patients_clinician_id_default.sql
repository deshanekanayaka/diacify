-- Defaults clinician_id to the caller's own id, so inserting code never
-- has to (and can't accidentally forget to) pass it explicitly. This is
-- a convenience on top of the RLS policy from the previous migration,
-- not a replacement for it — WITH CHECK still rejects an explicit
-- clinician_id that doesn't match the caller.
alter table patients
  alter column clinician_id set default auth.uid();
