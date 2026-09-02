# Progress

Completed features/tasks, one line each. Newest first.

- Backend API design, slice 3 — GET /api/patients via a request-scoped supabase-js client, typed against generated DB types, pagination hardened against unsafe integers and non-deterministic ordering, test-data cleanup added (PR #32)
- Backend API design, slice 2 — patients table with RLS-enforced ownership, real cross-tenant isolation test against local Postgres, anon default-privileges bug found via review and fixed at the root (PR #30)
- Backend API design, slice 1 — Supabase JWT auth gatekeeper (local JWKS verification, boot-time env validation), verified end-to-end against the real Supabase project (PR #28)
- ML preprocessing pipeline — raw CSV → clean, imputed, feature-engineered, labeled rows (PRs #10–#18)
