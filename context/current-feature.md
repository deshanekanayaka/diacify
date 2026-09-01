# Current Feature

**Feature:** Backend API design (Node/Express, Supabase Auth + RLS)

## Status

In progress. First slice (auth gatekeeper) implemented on
`feature/api-auth-gatekeeper`, not yet merged.

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

**Remaining:**
- Patients table schema + RLS + cross-tenant isolation test (slice 2)
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

## Context files

Read these first, every session:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/progress.md — completed features
- @context/current-feature.md refer to this if anything is unclear
