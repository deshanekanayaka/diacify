# Architecture Decision Record

Per `CLAUDE.md` §8: meaningful architectural, domain, security, data, ML, or
product decisions get recorded here. Trivial implementation detail doesn't.
Entries are numbered chronologically and never renumbered; a decision that
gets reversed is marked **Superseded**, not deleted or edited in place — the
original reasoning stays visible.

D1–D6 below were resolved during Phase 1 (investigation) and are recorded in
full essay form, with rejected alternatives and an interview-ready
explanation, in `docs/phase-1-investigation.md`. Entries here summarize each
one and link to the fuller writeup rather than duplicating it. Every ADR from
008 onward belongs to Phase 2 (the vertical-slice rebuild) and is recorded
here first-hand.

---

## ADR-001 — One application: Node.js, with ML training staying offline Python

**Status:** Accepted — 2026-08-31

**Context:** The legacy system ran three independently-deployed services
(React frontend, Node/Express backend, Python/FastAPI ML service) sharing no
code. `CLAUDE.md` D1 defaults to one primary language/application unless a
second is consciously justified.

**Decision:** One application — Node.js for the backend, including ML
*inference*. Model *training* stays a separate, offline Python step (as it
already was), never committed as a running service.

**Rejected:** Keeping the Python FastAPI service permanently (two deploy
targets, a cross-language contract, indefinitely); rewriting the whole
backend in Python too (discards a working Express backend for no
ML-related reason).

**Consequences:** The ML serving surface (feature construction, `predict_proba`,
score/category formulas) has to be ported to Node function-by-function,
checked against the same fixtures `machine-learning/tests/test_model.py`
already uses — training-time logic (BP dual-encoding fix, label-assignment
rule, imputation) doesn't move at all.

**Full reasoning:** `docs/phase-1-investigation.md` § "Decision D1 — resolved"

---

## ADR-002 — Ground-up rebuild scope; single ML dataset kept

**Status:** Accepted — 2026-08-31

**Context:** Whether the rebuild ports legacy code/schema/migrations, and
whether the ML training dataset should be augmented beyond the single Erbil
diabetes dataset the legacy model was trained on.

**Decision:** True ground-up rebuild — no migrations, code, or schema carried
over mechanically; legacy is reference material only. Training data stays the
single Erbil dataset (Mendeley DOI 10.17632/3snnp89967.1) for now.

**Rejected:** Augmenting with NHANES or another Mendeley dataset now (deferred,
not ruled out — revisit only if the rebuilt model's own evaluation shows a
real generalization gap); a UK dataset (blocked by access/governance —
UK Biobank/CPRD/QResearch all require institutional affiliation and a fee).

**Consequences:** Dataset augmentation is deferred until a *measured* gap
justifies it, not taken up front speculatively — avoids repeating the exact
bug class already found inside Erbil's own data (BP dual-unit encoding across
its own rows).

**Full reasoning:** `docs/phase-1-investigation.md` § "Decision D1a"

---

## ADR-003 — Ownership scoping: explicit convention, not a repository layer

**Status:** Superseded by ADR-007 (2026-08-31, same session)

**Context:** How cross-tenant data ownership (`clerk_id` scoping) gets
enforced structurally.

**Decision:** Manual, explicit `WHERE clerk_id = ?` in every query, backed by
a lint rule/review checklist — not hidden behind a repository/data-access
abstraction.

**Rejected:** A repository layer (structurally safer, but hides the scoping
pattern behind an interface — works against the project's explicit goal of
every line being explainable); Postgres RLS (premature at the time — the
database engine was still MySQL, see ADR-005).

**Why superseded:** ADR-006 moved the database to Supabase/Postgres, which
made RLS the idiomatic, natively-supported mechanism rather than an awkward
bolt-on — reversing this decision's premise.

**Full reasoning:** `docs/phase-1-investigation.md` § "D2 — Ownership scoping
enforcement"

---

## ADR-004 — Frontend/backend contract: one shared Zod schema

**Status:** Accepted — 2026-08-31

**Context:** The legacy frontend and backend each hand-maintained their own
validation rules, and they'd drifted (frontend's `checkWarnings` missing
branches the backend had).

**Decision:** A single Zod schema module, imported by both backend and
frontend; TypeScript types inferred from it (`z.infer`), never hand-duplicated.

**Rejected:** An OpenAPI spec with generated clients (more tooling than a
one-frontend/one-backend system needs); server-only validation (loses live
client-side feedback while a clinician is typing).

**Consequences:** Only cheap because of ADR-001 — one language on both sides.
Client/server validation drift becomes structurally impossible, not just
disciplined against.

**Full reasoning:** `docs/phase-1-investigation.md` § "D3 — Frontend/backend
contract"

---

## ADR-005 — Database engine: stay on MySQL

**Status:** Superseded by ADR-007 (2026-08-31, same session)

**Context:** Whether to keep MySQL (already understood from Phase 1) or move
to Postgres.

**Decision:** Stay on MySQL, accepting self-hosted backups/upgrades/disk
sizing on Render as a deliberate operational cost (Render manages Postgres
natively, not MySQL).

**Rejected:** Postgres (native managed hosting, future RLS option) — rejected
for continuity with the already-understood schema, not for a technical reason
outweighing the managed-hosting benefit.

**Why superseded:** ADR-006 moved to Supabase-managed Postgres, which removes
the exact self-hosting burden this decision had knowingly accepted.

**Full reasoning:** `docs/phase-1-investigation.md` § "D4 — Database engine"

---

## ADR-006 — Deployment topology: Render backend + Vercel frontend

**Status:** Partially superseded by ADR-007's three-provider topology
(2026-08-31, same session) — the Render+Vercel split itself stands; the
"+MySQL on Render" part does not.

**Context:** Whether to deploy as one Render service or split frontend/backend
across providers.

**Decision:** Split — Node backend on Render, React frontend on Vercel,
matching legacy's frontend deploy target.

**Rejected:** All-Render (simpler, single-provider, but doesn't read as an
independently visible React deployment); single-process-serves-both (fewest
moving parts, but couples deploy cadence and loses Vercel's edge caching).

**Consequences:** Reintroduces a real CORS boundary between two origins —
something the rebuild has to configure correctly, not inherit for free.

**Full reasoning:** `docs/phase-1-investigation.md` § "D5 — Deployment
topology"

---

## ADR-007 — Identity and database platform: Supabase (Auth + Postgres + RLS)

**Status:** Accepted — 2026-08-31. Supersedes ADR-003, ADR-005, ADR-006's
database/hosting portion.

**Context:** Reframed mid-Phase-1 as a learning opportunity, not just an infra
choice: Clerk (the legacy auth provider) is a fully managed black box — the
app trusts an SDK's verification with no visibility into token mechanics.

**Decision:** Supabase for both Postgres hosting and authentication,
free tier. Specifically: `auth.users` as a real, queryable table with
`clinician_id` as a genuine foreign key (not Clerk's opaque `clerk_id`
string); Postgres Row-Level Security keyed on `auth.uid()`, not a manual
`WHERE` convention; three-provider topology (Render + Vercel + Supabase).

**Rejected:** Clerk (fast to integrate, but teaches integration skill, not
auth mechanics — opposed to the stated learning goal); self-hosted MySQL on
Render (ADR-005's original call); the repository-layer and convention-only
options from ADR-003; Supabase Pro tier ($25/mo — free tier accepted instead,
knowingly trading away always-on and automated backups).

**Consequences:** RLS fails open, not closed, when a policy is missing or an
`UPDATE` policy lacks `WITH CHECK` — this is *why* a cross-tenant isolation
test became mandatory for the first table onward (see ADR-011). Free tier
means a 7-day inactivity pause and no backups — accepted, revisit if this
needs to be reliably demoable on demand.

**Full reasoning:** `docs/phase-1-investigation.md` § "Decision D6"

---

## ADR-008 — Backend API design: Supabase JWT + RLS, no API-key system

**Status:** Accepted — 2026-09-01

**Context:** A generic API-design guide brought into the project assumes a
public, API-key-authenticated developer product. Diacify is a first-party app
already committed (ADR-007) to Supabase Auth (JWT) + Postgres RLS.

**Decision:** Adapt the guide rather than adopt it wholesale — drop the
API-key/gatekeeper-hashing sections entirely (no `api_keys` table). Keep its
other principles (rolling-window rate limiting, RLS as defense-in-depth,
filter/pagination naming, CORS preflight handling, `{ error: "message" }`
error shape), adapted to JWT auth.

**Rejected:** Building API-key support speculatively for a third-party-consumer
use case that doesn't exist in Diacify's domain.

**Consequences:** Every endpoint's auth story is "verify the caller's Supabase
JWT," full stop — no second credential type to design, document, or rotate.

---

## ADR-009 — JWT verification: local (JWKS), not a live Supabase Auth API call

**Status:** Accepted — 2026-09-01

**Context:** Every authenticated request needs to verify the caller's JWT.
Supabase offers a client SDK call (`supabase.auth.getUser(jwt)`, a live
network round-trip) as an alternative to local signature verification.

**Decision:** Verify the token's signature locally against Supabase's cached
JWKS public key (`jose`'s `createRemoteJWKSet`), not a live SDK call.

**Rejected:** `supabase.auth.getUser(jwt)` per request — simpler to write, but
makes every authenticated request depend on Supabase's uptime, and delegates
the actual verification mechanics to an SDK call instead of understanding
them (the whole reason ADR-007 chose Supabase over Clerk).

**Consequences:** Accepted trade-off: a banned/deleted clinician's token stays
valid until it naturally expires (Supabase default ~1hr) — there's no
per-request revocation check. In exchange, no per-request network dependency
on Supabase's Auth API.

---

## ADR-010 — Config validation: boot-time, not per-request

**Status:** Accepted — 2026-09-01

**Context:** The approved spec for the auth gatekeeper listed a 500 response
for "required env var unset."

**Decision:** Validate required environment variables once at server startup
(`backend/src/config/env.ts::loadEnv`), crashing immediately if anything's
missing — not checked per-request.

**Rejected:** A per-request check inside `requireAuth` — "env var unset" is a
startup-time condition, not something that can meaningfully vary request to
request.

**Consequences:** A misconfigured deploy fails loudly before it accepts any
traffic, rather than surfacing as an intermittent 500 on the first request.
`requireAuth` itself has no reachable 500 path once the server is running.

---

## ADR-011 — Patients RLS policy: single `FOR ALL` policy, `USING` + `WITH CHECK` both required

**Status:** Accepted — 2026-09-01

**Context:** ADR-007 committed to RLS as the ownership-scoping mechanism.
First table (`patients`) needed a concrete policy design, with the mandatory
cross-tenant isolation test ADR-007 flagged as non-negotiable.

**Decision:** One `FOR ALL TO authenticated` policy on `patients`, with both
`USING (clinician_id = (SELECT auth.uid()))` and an identical `WITH CHECK`
clause — `USING` alone would leave `UPDATE` able to reassign a row's
`clinician_id` to someone else's, since `WITH CHECK` is what governs the
value a row is allowed to end up with, not just which existing rows are
visible.

**Consequences:** Verified with a real test against local Postgres (not
mocked): two real clinician accounts, clinician A creates a patient,
clinician B proven unable to `SELECT`/`UPDATE`/`DELETE` it, an anonymous
request rejected outright.

---

## ADR-012 — Table-level access defaults: revoke `anon`'s default privileges at the role level

**Status:** Accepted — 2026-09-02

**Context:** A bug (logged in `BUGS.md`) found via code review: `anon` had
full CRUD grants on `patients` despite the table's migration only ever
granting `authenticated` — Supabase auto-grants every new table to both roles
the instant `CREATE TABLE` runs, before a migration's own `GRANT` line
executes. RLS still blocked `anon` at the row level throughout (two
independent gates; one silently failed open, the other held — no data was
ever actually exposed), but the table-level gate wasn't closed the way it was
documented to be.

**Decision:** Fix at the root, not per-table: revoke `anon`'s existing grant
on `patients`, and revoke the *default privilege* itself
(`ALTER DEFAULT PRIVILEGES ... REVOKE ALL ON TABLES FROM anon`), so every
future table created by a migration starts closed to `anon` by construction.

**Threat addressed:** An unauthenticated caller reaching table-level access at
all on any future table, relying solely on RLS (a second, independent gate)
to have been configured correctly — two gates is the point; this decision
keeps the first one closed by default instead of by remembering to `GRANT`
narrowly every time.

**Consequences:** Re-verified against the real project
(`information_schema.role_table_grants` shows zero rows for `anon` on
`patients`).

---

## ADR-013 — Request-scoped `@supabase/supabase-js` client, not raw `pg` with role impersonation

**Status:** Accepted — 2026-09-02

**Context:** `GET /api/patients` needed to query Postgres in a way that lets
RLS actually run as the calling clinician, not as a superuser/service role
that would bypass it.

**Decision:** Build a fresh `@supabase/supabase-js` client per request, from
the caller's own verified JWT (`backend/src/db/requestClient.ts`) — every
query runs as the `authenticated` Postgres role with `auth.uid()` resolving
from that token.

**Rejected:** A raw `pg` connection pool with hand-rolled Postgres session
role impersonation (`SET ROLE`/`SET LOCAL`) — a mistake in manual
impersonation fails *silently*: queries run as superuser, RLS does nothing,
and nothing errors. A worse version of the exact bug class found and fixed in
ADR-012.

**Consequences:** `requireAuth`'s `req.user` grew a second field (`accessToken`,
the raw JWT, not just the decoded `sub`) so route handlers can build this
per-request client. Typed as `SupabaseClient<Database>` against generated
types (`supabase gen types typescript`), so `.from()` calls get compile-time
table/column checking.

---

## ADR-014 — `patients.sex` is the only patient-level clinical attribute ported from legacy

**Status:** Accepted — 2026-09-03

**Context:** Legacy stored three patient-level fields (`sex`, `social_life`,
`genetics`). A slice-3 note had called their valid values "undocumented" —
investigation for this slice found that was wrong: they're fully specified in
`machine-learning/clinical_fields.py` (the rebuild's own ML code). Checking
`machine-learning/feature_matrix.py` and `model_metadata.json` against that
found only `sex` feeds the trained model — `genetics` was measured at 0.0003
feature importance and dropped; `social_life` was never included.

**Decision:** `patients.sex` (Postgres enum `patient_sex`, `NOT NULL`) is the
only new column this slice adds. `genetics` and `social_life` stay off the
table.

**Rejected:** Porting all three for legacy parity — would mean carrying two
fields our own feature-importance work rejected, and inventing a storage
format (set of relatives vs. legacy's ambiguous derived count) for data
nothing consumes. Porting `sex` + `genetics` (family history as clinical
record-keeping independent of the model) — a legitimate case, but the domain
owner's call was to defer it deliberately rather than add it now with no
reader, since there's no production data yet and adding a nullable column
later is a one-line migration.

**Consequences:** `genetics` remains a real, open product question — worth
adding as its own slice (storing the affected-relative *set*, not legacy's
derived count) if a clinician-facing need for family history shows up, or a
larger retrain changes the feature-importance measurement.

---

## ADR-015 — `POST /api/patients` creates patient identity only, not identity + first visit

**Status:** Accepted — 2026-09-03

**Context:** Legacy's `POST /api/patients` created a patient *and* its first
visit (with an ML risk score) in one database transaction, calling the ML
service before opening the transaction so a slow/dead ML service never held a
lock. The rebuild has no `visits` table yet.

**Decision:** This slice's `POST /api/patients` creates patient identity
only. `visits` (and the patient+visit bundling question) is deferred to its
own slice.

**Rejected:** Bundling patient + first visit in one transaction now — would
have folded designing the `visits` schema, its RLS policy, a ~13-field Zod
schema, a cross-table transaction, and the facts-vs-derived-values split
(`CLAUDE.md` §12, since legacy's `visits` row holds both raw measurements and
the model's derived `risk_score`/`risk_category` on the same row) into a
slice whose actual purpose was proving RLS-on-write and rate limiting.

**Consequences:** The API isn't usable end-to-end for a real clinician until
the `visits` slice lands — a patient with zero visits is clinically inert.
Explicitly accepted as this slice's scope, not an oversight.

---

## ADR-016 — Rate limiting: hand-rolled, in-memory, per-process rolling window

**Status:** Accepted — 2026-09-03

**Context:** ADR-008 carried over the API-design guide's "rolling-window rate
limiting" principle. `POST /api/patients` is the first endpoint that needs
one, keyed on clinician id.

**Decision:** A hand-written rolling window (`backend/src/middleware/rateLimit.ts`):
per-key list of recent request timestamps, expired entries dropped on read.
20 requests/clinician/60s on this route, mounted after `requireAuth`.

**Rejected:** `express-rate-limit` — its default memory store implements a
*fixed* window (resets all counters at a clock boundary), not the rolling
window the guide's principle actually calls for, so adopting it would have
meant configuring around its default behavior rather than getting the
intended semantics for free.

**Threat addressed:** An authenticated client — a buggy retry loop, or a
stolen token — flooding writes, inflating the database and burning Supabase
quota.

**Consequences, accepted explicitly:** In-memory and per-process — correct
for a single backend instance; counters reset on restart and are wrong (each
instance has its own count) if the backend ever runs as more than one
instance. Does **not** protect against unauthenticated floods — keying on
clinician id requires `requireAuth` to have already resolved an identity, so
an IP-keyed limiter in front of auth is a separate, undecided concern.
Map entries are evicted once idle to avoid unbounded growth, though a
clinician who makes exactly one request and never returns still leaves a
small, permanent entry — accepted as negligible at Diacify's per-clinic
scale rather than solved with a background sweep.
