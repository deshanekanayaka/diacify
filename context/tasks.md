# Tasks

Live task state, groomed weekly. One line per task: `- [ ] <task> (<phase/sprint>)`. Move done items to progress.md as one-line entries, do not accumulate them here.

## Now

- [ ] Open PR for slice 6 (`GET /api/patients/:id/visits`) and merge to main
- [ ] Decide `req.user` access: cast to `AuthenticatedRequest` vs Express global type-augmentation (deferred since slice 4; now 4 call sites)
- [ ] Scope slice 7 (backend API design) — candidates: `visit_date` filtering, appointments, or the Node-side ML predict endpoint (ADR-001)
