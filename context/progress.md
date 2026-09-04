# Progress

Completed features/tasks, one line each. Newest first.

- Backend API design, slice 4 — `POST /api/patients` + per-clinician rolling-window rate limiting, `patients.sex` added as the one clinical attribute the trained model actually uses (verified against `machine-learning/feature_matrix.py`, not guessed), `docs/decisions.md` created as the project's first ADR log (PR #34)
- Backend API design, slice 3 — `GET /api/patients` (paginated, own rows only) via a request-scoped Supabase client, review hardening (compile-time-typed queries, safe-integer pagination bounds, test-user cleanup, deterministic sort tiebreaker) (PR #32)
- Backend API design, slice 2 — patients table with RLS-enforced ownership, real cross-tenant isolation test against local Postgres, anon default-privileges bug found via review and fixed at the root (PR #30)
- Backend API design, slice 1 — Supabase JWT auth gatekeeper (local JWKS verification, boot-time env validation), verified end-to-end against the real Supabase project (PR #28)
- ML model training and evaluation — leakage-safe split, tuned RandomForestClassifier, cross-validation, bias audit, persisted model + metadata + run-everything script (PRs #19–#26)
- ML preprocessing pipeline — raw CSV → clean, imputed, feature-engineered, labeled rows (PRs #10–#18)
