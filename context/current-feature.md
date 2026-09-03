# Current Feature

**Feature:** Backend API design (Node/Express, Supabase Auth + RLS)

## Status

In progress. Slice 1 (auth gatekeeper) merged to main (PR #28).
Slice 2 (patients table + RLS, plus the anon-default-privileges bug
fix) merged to main (PR #30). Slice 3 (`GET /api/patients`, plus
review hardening and 3 logged bugs) merged to main (PR #32). Slice 4
(`POST /api/patients` + rate limiting) implemented on
`feature/post-patients-endpoint`, not yet merged.

Note: the previous feature, "ML model training and evaluation," is
complete (PRs #19–#26, see `context/progress.md`) but its "Done" status
update lives on an unmerged branch (`docs/archive-ml-model-training`)
that hadn't reached `main` when this feature branched. Reconcile the
two when that branch merges.

## Goals

Design and build Diacify's backend API from scratch (no backend code
existed before this feature — see `docs/phase-1-investigation.md`
D1/D1a/D6). Adapted from a generic API-design guide the user brought
in, with one correction made explicit up front: the guide assumes a
public, API-key-authenticated developer product; Diacify is a
first-party app already committed (D6) to Supabase Auth (JWT) +
Postgres Row-Level Security, so the API-key/gatekeeper-hashing
sections of the guide were dropped rather than adopted wholesale. Its
other principles (rolling-window rate limiting, RLS as
defense-in-depth, filter/pagination naming, CORS preflight handling,
`{ error: "message" }` error shape) carry over adapted to JWT auth.

## Decisions made

- **Auth mechanism kept to what D6 already chose**: Supabase JWT +
  Postgres RLS, not a parallel API-key system. No `api_keys` table.
  Rejected building API-key support speculatively for a third-party-
  consumer use case that doesn't exist in Diacify's domain.
- **JWT verification: local, not a live call to Supabase's Auth API.**
  Verify the token's signature locally against Supabase's cached JWKS
  public key (via `jose`), rather than calling
  `supabase.auth.getUser(jwt)` on every request. Trade-off accepted: a
  banned/deleted clinician stays valid until their token naturally
  expires (Supabase default ~1hr), in exchange for no per-request
  network dependency on Supabase's uptime, and for actually
  understanding JWT verification mechanics (the whole reason D6 chose
  Supabase over Clerk) instead of delegating it to an SDK call again.
- **Config validation moved from per-request to boot-time.** The
  approved spec's response table listed a 500 for "required env var
  unset," but that's a startup-time condition, not a per-request one —
  implemented as a fail-fast crash on server start instead, so
  `requireAuth` itself has no reachable 500 path once the server is
  running.
- **`patients` gets exactly one clinical attribute (`sex`), not
  legacy's three.** Investigated the rebuild's own ML pipeline
  (`machine-learning/feature_matrix.py`, `model_metadata.json`) rather
  than guessing at the "undocumented" values flagged in slice 3: `sex`
  is the only patient-level field the trained model actually consumes;
  `genetics` was measured at 0.0003 feature importance and dropped;
  `social_life` was never included. Domain owner's call, made
  knowingly against the ML evidence: `genetics` stays deferred (not
  ported) because diabetes family history is clinically meaningful for
  a clinician to have on record even though this model doesn't use it
  — worth adding later as its own slice, storing the affected-relative
  set rather than legacy's ambiguous derived count. `social_life`
  dropped outright; no case for it in either role.
- **Slice 4 ships patient identity only, not patient + first visit.**
  Legacy's `POST /api/patients` created a patient and its first visit
  (with an ML score) in one transaction. The rebuild currently has no
  `visits` table at all, so bundling would have folded 3-4 slices of
  design (visits schema, its RLS policy, a ~13-field Zod schema, a
  cross-table transaction, the facts-vs-derived-values split from
  CLAUDE.md §12) into a slice whose actual purpose is proving RLS-on-
  write and rate limiting. Deferred to a `visits` slice on its own.

## Implementation plan

Vertical slices, smallest defensible thing first — auth proven in
isolation before any schema or data exists:

1. Auth gatekeeper only — verify a Supabase JWT, 401/503, no data yet
2. First table + RLS, proven with a mandatory cross-tenant isolation
   test (clinician A must never read/write clinician B's rows — D6
   flagged this as non-negotiable)
3. First real endpoint — `GET /api/patients` (list, own rows only,
   paginated/filtered)
4. First write endpoint — `POST /api/patients`, with rate limiting
   added (rolling window, keyed on clinician id)

**Done:**
- Auth gatekeeper — `backend/src/middleware/requireAuth.ts`,
  `createRequireAuth` (6 tests: missing header, malformed header,
  wrong signature, expired token, valid token, key-fetch failure →
  503). Backend scaffolding (TS strict, Express, Vitest, ESLint).
- Boot-time env validation — `backend/src/config/env.ts::loadEnv`
  (2 tests: throws if `SUPABASE_URL` unset, returns it when set).
- Real Supabase wiring — `backend/src/auth/supabaseJwks.ts`
  (`createRemoteJWKSet` against `/auth/v1/.well-known/jwks.json`) +
  `backend/src/server.ts` (`GET /health` public, `GET /api/whoami`
  protected — temporary, proves the gatekeeper end-to-end, will be
  replaced by a real endpoint in slice 3).
- **Verified against the real Supabase project**
  (`wyyufufcbecorvrnoseh`), not just fixtures: confirmed the project
  already uses asymmetric signing (`ECC P-256`, current key) rather
  than the legacy HS256 shared secret — checked directly in the
  dashboard rather than assumed, since Supabase's docs don't state
  what new projects default to. Got a real access token from a
  dashboard-created test user via the password grant endpoint, hit the
  running server's `/api/whoami` with it: `200`, `userId` matched the
  token's `sub` claim exactly. Unauthenticated request to the same
  route against the real server: `401`, as expected.
  (all on `feature/api-auth-gatekeeper`, not yet merged)

- Patients table + RLS — `supabase/migrations/`: creates `patients`
  (`id uuid`, `clinician_id uuid references auth.users(id) on delete
  cascade default auth.uid()`, `created_at`), enables RLS with one
  `for all to authenticated` policy (`USING` + `WITH CHECK` both
  present — an UPDATE policy needs `USING` to find the row at all, and
  without `WITH CHECK` a clinician could reassign a row's
  `clinician_id` to someone else's), plus an explicit `GRANT` to
  `authenticated`.
  `backend/src/db/patients.rls.test.ts` (5 tests, against a real local
  Postgres via `supabase start` — not mocked): two real clinician
  accounts signed up inline (local stack auto-confirms, unlike the
  real project), clinician A creates a patient, clinician B is proven
  unable to SELECT/UPDATE/DELETE it, an anonymous request is rejected
  outright. Ran `supabase db advisors` against the real project after
  pushing — clean on everything this migration touches (two unrelated
  pre-existing findings surfaced, see Notes).
- **Bug found via code review, fixed and logged** (`BUGS.md`): `anon`
  actually had full CRUD grants on `patients` despite the migration
  only ever granting `authenticated` — Supabase's project-level default
  privileges auto-grant every new table to `anon`/`authenticated` the
  instant `CREATE TABLE` runs, before a migration's own `GRANT` line
  executes. RLS still blocked `anon` at the row level throughout (two
  independent gates; one silently failed open, the other held — no
  data was ever actually exposed), but the table-level gate wasn't
  really closed the way it was documented to be. Fixed at the root
  with a new migration: revoked `anon`'s existing grant, and revoked
  the default privilege itself (`alter default privileges for role
  postgres in schema public revoke all on tables from anon`) so every
  *future* table starts closed, not just `patients`. Re-verified
  against the real project (`information_schema.role_table_grants`
  shows zero rows for `anon` on `patients` now) and the full test
  suite still passes.

- `GET /api/patients` (slice 3) — architecture decision first: the
  backend queries Postgres via a **request-scoped `@supabase/supabase-js`
  client** built per-request from the caller's own verified JWT
  (`backend/src/db/requestClient.ts::createRequestClient`), not a raw
  `pg` connection with hand-rolled role impersonation. Rejected the
  raw-`pg` option specifically because a mistake in manual session
  impersonation fails silently (queries run as superuser, RLS does
  nothing) — a worse version of the bug just found and fixed in slice
  2. This meant `requireAuth`'s `req.user` grew a second field,
  `accessToken` (the raw JWT, not just the decoded `sub`), so route
  handlers can build that per-request client.
  `backend/src/routes/pagination.ts::parsePagination` (8 tests, pure
  function): parses `limit`/`page`, defaults 20/1, non-numeric or `< 1`
  rejected with 400, a limit above 100 is silently clamped rather than
  rejected (still a reasonable request). No `sort`/filter query params
  yet — `patients` has only one sortable column (`created_at`, fixed
  descending) and no filterable clinical columns, so exposing params
  with a single possible value would be premature surface.
  `backend/src/routes/patients.ts::createPatientsRouter` — `GET /`
  behind `requireAuth`, response `{ data, page, limit, total }`.
  `backend/src/routes/patients.test.ts` (6 tests, against real local
  Postgres via `supabase start`, exercising the actual HTTP route with
  `supertest`, not just the DB layer): 401 with no auth, a clinician's
  own patients returned newest-first, an empty list (not an error) for
  a clinician with none, pagination, both 400 cases. Also verified
  against the real Supabase project: `200` with the caller's real
  (empty) patient list, `401` unauthenticated.
  Temporary `/api/whoami` route from slice 1 removed — this is the
  real endpoint it was standing in for.
- **Hardening from a pre-merge review pass** (4 findings pasted by the
  user, each independently verified against real behavior before
  fixing — one was stale, three were real):
  - Generated `backend/src/db/database.types.ts` (`supabase gen types
    typescript --linked`, regenerate after any migration) and typed
    `createRequestClient` as `SupabaseClient<Database>` — `.from()`
    calls now get compile-time table/column checking instead of
    trusting a bare string.
  - `parsePositiveInt` now also requires `Number.isSafeInteger` — a
    `page` like `99999999999999999999` previously passed validation
    (regex + `>= 1`) and produced `from`/`to` as `1e+22`. Tested
    directly against the real client: it happened to degrade
    gracefully (`200`, empty data) rather than crashing, but that's
    incidental behavior of Supabase's HTTP layer, not something
    validation should rely on. Fixed at the one validation boundary,
    not duplicated as a second check in the route.
  - Both RLS/route test files accumulate test users otherwise —
    confirmed directly (9 auth users, 8 orphaned patient rows already
    on the local stack before this fix, from repeated runs this
    session). Added `backend/src/db/testCleanup.ts::deleteTestUser`
    (admin-API delete, local-stack-only — `clinician_id`'s `on delete
    cascade` means deleting the user also removes their patients, no
    separate cleanup needed) and wired `afterAll` into both test
    files. Confirmed fixed by running the suite twice and checking the
    count stayed flat rather than growing.
  - Added a secondary `.order("id", { ascending: false })` after
    `created_at` in the patients query — Postgres doesn't guarantee
    stable row order across paginated queries when the sort key has
    ties. Added a test that walks every page and checks no patient is
    repeated or omitted — but it doesn't force an actual tie (not
    reliably achievable via the public signup/insert API), so it
    verifies general pagination completeness rather than regression-
    testing the tie-break case specifically. Said so plainly rather
    than implying the test proves more than it does.

- `POST /api/patients` + rate limiting (slice 4) — new migration
  `supabase/migrations/20260903183030_add_patient_sex.sql` adds
  `sex patient_sex not null` (a Postgres enum, not `text` + `CHECK`,
  so `supabase gen types` turns an invalid value into a compile error
  at the `.insert()` call rather than a runtime constraint violation).
  `not null` with no default, safe to add directly since both the
  local stack and the real project had zero `patients` rows at
  migration time (checked directly, not assumed).
  `backend/src/routes/createPatientSchema.ts` — Zod, `.strict()` so an
  unknown field (in particular a caller-supplied `clinician_id`) is a
  400 rather than silently dropped; `clinician_id` is never accepted
  from the request body, it comes from the column's own `auth.uid()`
  default and slice 2's `WITH CHECK` rejects any row that would land
  on another clinician (4 tests).
  `backend/src/middleware/rateLimit.ts::createRateLimiter` — a true
  rolling window (per-key timestamp list, expired entries dropped on
  read, not a fixed-bucket reset), keyed on `req.user.id`, clock
  injectable for tests (4 tests: allows-to-limit, blocks-over-limit,
  allows-again-after-window-rolls, separate buckets per clinician).
  Hand-written rather than `express-rate-limit` — its default memory
  store is a fixed window, so matching the "rolling window" principle
  from the API-design guide meant writing it anyway. In-memory,
  per-process: correct for one backend instance, resets on restart,
  wrong once there's more than one instance — recorded as a real
  trade-off, not hidden. Threat named: an authenticated client (buggy
  retry loop, or a stolen token) flooding writes; does not protect
  against unauthenticated floods, since keying on clinician id
  requires `requireAuth` to have already run.
  Mounted at 20 requests/clinician/60s rolling window on `POST
  /api/patients` only (`backend/src/server.ts`).
  `backend/src/routes/patients.ts` — `POST /` behind `requireAuth` +
  the rate limiter: validate → insert via the request-scoped client →
  `201 { data }`. `express.json({ limit: "10kb" })` mounted globally
  (first body-parsing need in the app); a dedicated error handler
  turns a malformed-JSON parse failure into `{ error }` JSON instead
  of Express's default HTML error page.
  `backend/src/routes/patients.test.ts` (7 new tests, real local
  Postgres + supertest): 401 unauthenticated, 201 with the row owned
  by the caller, caller-supplied `clinician_id` → 400 + nothing
  written, invalid `sex` → 400 + nothing written, a created patient
  visible to its owner via `GET` but not to a second clinician
  (cross-tenant isolation re-proven on the write path per D6), 429
  once a low test limit is exceeded.
  Existing `patients.rls.test.ts` and `patients.test.ts` fixture
  inserts updated from `insert({})` to `insert({ sex: ... })` since
  `sex` is now required.
  **Verified against the real Supabase project**: pushed the
  migration (`supabase db push --linked`), confirmed
  `supabase gen types typescript --linked` matches the local-generated
  types exactly on the `patients`/`patient_sex` shape. Real project
  requires email confirmation (unlike the local stack), so a live test
  user had to be created through the dashboard's "Add user → Auto
  Confirm User" rather than signed up inline — got a real access token
  via the password-grant endpoint, then hit the running server for
  real: `401` unauthenticated, `201` with a real row, `400` for
  invalid `sex` and for a caller-supplied `clinician_id`, the created
  row visible via a real `GET`, and a real `429` (with `Retry-After:
  60`) after 20 writes in the rolling window. Cleaned up the test rows
  afterward via the clinician's own token (RLS-scoped delete) —
  `supabase db advisors --linked` re-run afterward, same two
  pre-existing findings as slice 3, nothing new. Two throwaway auth
  users from this verification are still sitting in the real project
  (`diacify.slice4.verify+test@gmail.com`, unconfirmed; and the
  dashboard-created one) — not cleaned up, since deleting a user needs
  the `service_role` key or dashboard access, which this session
  deliberately doesn't hold. Harmless (no patient data attached, both
  already deleted), but worth a manual dashboard cleanup.
  Pre-existing `qs`/`body-parser` moderate advisories (transitive via
  `express`) confirmed unrelated to this slice — same 3 findings exist
  on `main` before this branch's `zod` addition.

**Remaining:**
- `visits` table + first clinical data (its own slice — see decisions
  made, above)
- Everything past that (appointments, analytics, ported ML-predict
  endpoint) — not yet planned in detail

## Notes

- `req.user` is still read via a cast to `AuthenticatedRequest` rather
  than Express global type-augmentation. Slice 4 added a third call
  site (`rateLimit.ts`) past the threshold slice 3's note named —
  flagged here rather than silently refactored mid-slice, since
  switching to global augmentation is a small but real design choice
  (touches every future route file); worth 30 seconds of discussion at
  the start of slice 5, not decided unilaterally here.
- `getKey` is a parameter to `createRequireAuth`, not hardcoded to
  Supabase's JWKS endpoint — production wiring will pass
  `createRemoteJWKSet(supabaseJwksUrl)`, tests pass
  `createLocalJWKSet(fixtureKeys)`. Same verification logic either
  way; this is what let the gatekeeper be fully tested without a live
  Supabase project existing yet.
- `requireAuth`/`jwtVerify` never restricts which signing algorithm is
  accepted — it verifies against whatever the JWKS resolver returns.
  This mattered in practice: the real project turned out to already be
  on asymmetric `ES256`, but the code would have worked unchanged
  against `RS256` too, since nothing hardcodes an expected algorithm.
- Installed the `supabase-community/supabase-plugin` Claude Code
  plugin (user scope) via `npx plugins add supabase-community/supabase-plugin`
  for Supabase-specific skills/docs access. Its MCP server (direct
  project querying) still needs interactive OAuth the user hasn't run
  yet — unavailable in non-interactive sessions until then.
- Patients' primary key: plain `uuid default gen_random_uuid()`, not
  legacy's human-readable `PAT-YYYY-NNNN` (which required a dedicated
  `id_sequences` table and concurrency-safe minting logic). Decided
  deliberately — that scheme is real, already-validated UX, but
  orthogonal to what this slice is actually testing (RLS ownership
  isolation) and adds a second hard problem to a slice meant to prove
  one. Revisit as its own slice if a human-readable identifier turns
  out to matter for the real UI.
- The slice-3 note about `sex`/`social_life`/`genetics`' valid values
  being undocumented was wrong — they're fully specified in
  `machine-learning/clinical_fields.py` (the rebuild's own ML code,
  not legacy's). Resolved in slice 4: see "Decisions made", above.
- Two pre-existing findings surfaced by `supabase db advisors
  --linked`, unrelated to this migration (not fixed — flagged, not
  silently patched, since they predate this slice): a Supabase-managed
  `rls_auto_enable` event-trigger function flagged as an anon/
  authenticated-callable `SECURITY DEFINER` function (likely a
  platform false-positive — it's an event-trigger function, not really
  RPC-callable in a meaningful way — but not independently confirmed);
  and leaked-password-protection being off in Auth settings (a
  one-toggle fix, whenever it's prioritized).
- Local Supabase dev stack (`supabase start`, Docker) is what made the
  RLS test practical at all: its `enable_confirmations = false` config
  means signups auto-confirm, unlike the real project — so two real
  clinician accounts can be created inline, in every test run, with no
  manual dashboard step and no need to ever hold the `service_role`
  key. `backend/.env.test` (gitignored, mirrors `.env.test.example`)
  points the test at `127.0.0.1:54321` with the local stack's fixed,
  non-secret default keys — kept separate from `backend/.env`, which
  still points `npm run dev` at the real project.

## Context files

Read these first, every session:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/progress.md — completed features
- @context/current-feature.md refer to this if anything is unclear
