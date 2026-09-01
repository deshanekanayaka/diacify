# Current Feature

**Feature:** Backend API design (Node/Express, Supabase Auth + RLS)

## Status

In progress. Slice 1 (auth gatekeeper) merged to main (PR #28).
Slice 2 (patients table + RLS) implemented on
`feature/patients-table-rls`, not yet merged.

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
  `authenticated` only (table-level access is separate from RLS — a
  new table has neither by default; `anon` deliberately gets no grant
  at all, so an unauthenticated request gets a hard permission error
  rather than a deceptively-empty result).
  `backend/src/db/patients.rls.test.ts` (5 tests, against a real local
  Postgres via `supabase start` — not mocked): two real clinician
  accounts signed up inline (local stack auto-confirms, unlike the
  real project), clinician A creates a patient, clinician B is proven
  unable to SELECT/UPDATE/DELETE it, an anonymous request is rejected
  outright. Ran `supabase db advisors` against the real project after
  pushing — clean on everything this migration touches (two unrelated
  pre-existing findings surfaced, see Notes).

**Remaining:**
- `GET /api/patients` (slice 3)
- `POST /api/patients` + rate limiting (slice 4)
- Everything past that (visits, appointments, analytics, ported
  ML-predict endpoint) — not yet planned in detail

## Notes

- `req.user` is read via a cast to `AuthenticatedRequest` rather than
  Express global type-augmentation, deliberately — there's only one
  call site (a test route) so far. Revisit once a second real route
  handler needs `req.user` (slice 3, `GET /api/patients`); adding the
  global augmentation now would be solving a duplication problem that
  doesn't exist yet.
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
- Left `sex`, `social_life`, `genetics` off the `patients` table for
  now — legacy had them, but their exact valid values (especially
  `social_life`'s and what `genetics`' 0–4 range means) aren't
  documented anywhere read so far, and guessing would mean inventing
  domain behavior. Deferred to whenever patient creation (a real Zod
  schema) is actually designed, rather than guessed here.
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
