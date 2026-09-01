-- A new table has no Data API access at all by default — this is
-- separate from RLS, which only controls which *rows* are visible once
-- a table is reachable. Grant only to authenticated: anon gets a hard
-- permission-denied rather than a deceptively-empty result, since
-- patient data should never be reachable by an unauthenticated caller
-- at all, not even to see zero rows.
grant select, insert, update, delete on patients to authenticated;
