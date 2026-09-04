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

**Consequences:** Once RLS is *enabled* on a table, Postgres defaults to
deny when no policy applies to a role/command — verified directly against a
local test table (an `authenticated` role querying an RLS-enabled table with
no policy at all gets zero rows, not every row). The real risk is a table
where RLS was never enabled in the first place, which stays fully open with
no policy involved — that's why a cross-tenant isolation test became
mandatory for the first table onward (see ADR-011), rather than trusting a
correctly-written policy by inspection. Free tier means a 7-day inactivity
pause and no backups — accepted, revisit if this needs to be reliably
demoable on demand.

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

## ADR-011 — Patients RLS policy: single `FOR ALL` policy, explicit `USING` + `WITH CHECK`

**Status:** Accepted — 2026-09-01

**Context:** ADR-007 committed to RLS as the ownership-scoping mechanism.
First table (`patients`) needed a concrete policy design, with the mandatory
cross-tenant isolation test ADR-007 flagged as non-negotiable.

**Decision:** One `FOR ALL TO authenticated` policy on `patients`, with both
`USING (clinician_id = (SELECT auth.uid()))` and an explicit, identical
`WITH CHECK` clause. Verified directly against a local test table that this
specific policy would have been safe even without the explicit `WITH CHECK`
— Postgres reuses `USING` as the implicit check on a `FOR ALL` policy when
`WITH CHECK` is omitted, so an `UPDATE` reassigning `clinician_id` to
another clinician is rejected either way (`new row violates row-level
security policy`, confirmed by testing the omitted-clause case directly).
The explicit clause is written anyway, for two reasons: relying on that
implicit fallback is easy to get wrong when reading the policy later (this
project initially documented the wrong mental model for it, corrected after
verification), and the implicit reuse doesn't carry over if this policy is
ever split into separate per-command policies.

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

---

## ADR-017 — `visits` ownership: join-based RLS policy, not a denormalized `clinician_id`

**Status:** Accepted — 2026-09-03

**Context:** `visits` is the first table owned only transitively — a visit
belongs to a patient, not directly to a clinician. Checked legacy's own
schema before assuming a precedent either way: legacy scoped `visits`
through `patients` too (it denormalized `clerk_id` only onto `appointments`,
a different table with a different reason).

**Decision:** One `FOR ALL` policy using `EXISTS (SELECT 1 FROM patients p
WHERE p.id = visits.patient_id AND p.clinician_id = auth.uid())` for both
`USING` and `WITH CHECK`. No `clinician_id` column on `visits`.

**Rejected:** A denormalized `visits.clinician_id` column with a flat
equality policy — this only secures the *read* path. On write, a clinician
can satisfy `WITH CHECK (clinician_id = auth.uid())` with their own id while
still pointing `patient_id` at another clinician's patient, because a
foreign key constraint only verifies the referenced row exists, not who owns
it — it doesn't consult RLS. Closing that gap would require the join check
anyway, at which point the denormalized column adds drift risk (two places
ownership could disagree) for no remaining benefit.

**Consequences:** Verified directly — no recursion risk, since `patients`'
own policy references only `auth.uid()`, never `visits` (the standard
Supabase footgun with cross-table policies). Performance is a non-issue at
per-clinic data volumes: `p.id` is the primary key, so the `EXISTS` is an
index lookup per row. The mandatory cross-tenant test for this slice had to
include the case a denormalized design would have missed: clinician A must
fail to *create* a visit against clinician B's patient, not just fail to
read one — this is what `visits.test.ts`'s "404 for another clinician's real
patient" test actually proves.

---

## ADR-018 — `visits` holds clinical facts only, no ML output columns

**Status:** Accepted — 2026-09-03

**Context:** Legacy's `visits` row combines raw measurements
(`bp_systolic`, `hba1c`, etc.) with model output (`risk_score`,
`risk_category`, `top_factors`, `confidence_low/medium/high`) on one row.
`CLAUDE.md` §12: "Keep facts and judgements conceptually separate... do not
combine them because it's convenient." There is no Node-side ML inference
yet (ADR-001's porting work hasn't started), so there's nothing to populate
score columns with even if they existed.

**Decision:** `visits` gets clinical measurement columns only. A future
table (referencing `visits.id`) will hold model output once ML serving is
ported, rather than growing `visits`' shape now.

**Rejected:** Reserving nullable score columns now, with `null` standing in
for legacy's `'pending'` state — reintroduces the exact fact/judgement
violation `CLAUDE.md` warns against, for columns nothing will write to for
at least one more slice. This is the cleanest case for the facts/judgements
principle so far in the project: there's no disagreement to arbitrate, since
the judgement side doesn't exist in the codebase at all yet.

**Consequences:** A dashboard view joining current-visit-plus-score will
need a second table once it exists — accepted, not treated as premature
optimization to avoid.

---

## ADR-019 — `visits` clinical fields: model-relevant set plus cholesterol/VLDL; plausibility bounds reuse existing constants

**Status:** Accepted — 2026-09-03

**Context:** Legacy's `visits` has 8 clinical measurement columns beyond
`age`/`bp`/`bmi`/`hba1c`. Checked which ones the rebuild's trained model
actually uses (`machine-learning/assemble.py`, `features.py`): `rbs`,
`trig`, `hdl`, `ldl` feed the model directly or via a derived ratio;
`cholesterol` and `vldl` are cleaned/imputed by the training pipeline but
never reach `FEATURE_NAMES` — same "measured, no signal" shape as ADR-014's
`genetics`.

**Decision:** All 6 nullable lab columns from legacy are kept
(`rbs`, `cholesterol`, `triglycerides`, `hdl`, `ldl`, `vldl`), unlike
ADR-014's `genetics`/`social_life`, which were dropped. Validation bounds:
`MIN_PLAUSIBLE_BMI`/`MAX_PLAUSIBLE_BMI`/`MIN_PLAUSIBLE_RBS`/the 30mmHg BP
floor are the exact constants already in `machine-learning/clinical_fields.py`,
reused rather than reinvented. Every upper bound (BP, HbA1c, age, lipids)
is new — `clinical_fields.py` only ever clips or corrects historical CSV
rows, it never rejects on an upper bound, because its job is salvaging old
data, not validating live entry.

**Rejected:** Dropping `cholesterol`/`vldl` for model-relevance-only parity
with ADR-014 — the domain owner's call was that a lipid panel is routine,
cheap, standard-of-care clinical data worth having on file independent of
this specific model, unlike `genetics` (requires actively asking about
family history) or `social_life` (no clinical case in either role).

**Consequences:** The new upper bounds are explicitly flagged as invented
(generous, "reject only what's essentially impossible" ceilings) rather than
clinically derived, so they don't carry more authority than they've earned.
`multipleOf` added to every numeric field, matching each column's declared
decimal scale (`numeric(5,1)` → 0.1, `numeric(_,2)` → 0.01) — without it, a
value with more decimal precision than the column can store (e.g.
`systolic: 138.76`) passes validation and gets silently rounded by Postgres
on insert; caught via code review, verified the failure mode is real before
fixing.

---

## ADR-020 — `visit_date`: caller-supplied, separate from `created_at`, future dates rejected with skew tolerance

**Status:** Accepted — 2026-09-03

**Context:** Legacy has `visit_date DATE NOT NULL` distinct from
`created_at TIMESTAMP`. Whether the rebuild keeps that distinction or
collapses to one server-generated timestamp.

**Decision:** `visit_date` stays caller-supplied (defaults to
`current_date` when omitted), separate from `created_at`. Rejected if more
than one day in the future.

**Rejected:** Collapsing to `created_at` only — `visit_date` is clinical
time (when the observation happened), `created_at` is system time (when the
row was written); collapsing them makes backdating impossible (a clinician
doing Wednesday paperwork for Monday's appointment) and would corrupt any
future trend feature, which needs to order by clinical time. No lower bound
on `visit_date` — any floor picked would be invented domain behavior with no
evidence behind it; historical backfill is plausible.

**Consequences:** The one-day future tolerance is deliberate, not sloppy —
validating a clinician's local date against the server's UTC date would
reject legitimate same-day entries for anyone ahead of UTC, which includes
Diacify's own clinical context (Erbil, UTC+3).

---

## ADR-021 — `createPatientsRouter` takes one options object, not four positional parameters

**Status:** Accepted — 2026-09-03

**Context:** Adding the visits route's own rate limiter as a fourth
positional constructor argument to `createPatientsRouter` triggered
`CLAUDE.md`'s own rule: "More than three arguments is a design smell."
Caught via code review, applying the project's own standard to code written
in the same slice.

**Decision:** `createPatientsRouter({ supabaseUrl, supabasePublishableKey,
createPatientRateLimit, createVisitRateLimit })` — one options object.

**Rejected:** Leaving it positional — two same-typed `RequestHandler`
arguments next to each other is exactly the kind of signature where a caller
can silently swap arguments in the wrong order with no compiler error;
already true with two, and would only get worse with a fifth route's rate
limiter.

**Consequences:** `server.ts` and both test files' `buildApp` helpers
updated to the keyed-argument call shape.

---

## ADR-022 — `GET /api/patients/:id/visits`: explicit patient lookup for 404, not an ambiguous empty list

**Status:** Accepted — 2026-09-04

**Context:** RLS behaves asymmetrically across read and write. On the write
path, `POST /api/patients/:id/visits` gets a `42501` from a `WITH CHECK`
violation and maps it to 404 (ADR-017). On the read path, a `SELECT` under
the same policy simply returns zero rows and no error — so the naive
one-query implementation cannot distinguish "your patient, no visits yet"
from "not your patient."

**Decision:** Look the patient up first via the same request-scoped client
(`select("id").eq("id", patientId).maybeSingle()`); a missing row returns
`404 { error: "Patient not found" }`, reusing the constant the POST path
already returns. Only then query `visits`.

**Rejected:** Always returning `200 { data: [] }` — one round trip, but it
makes a nonexistent patient indistinguishable from an empty history, so a UI
would render a blank visit list for a patient that isn't there, and the same
URL would answer 404 to `POST` and 200 to `GET` for the identical bad id.
Also rejected a single PostgREST embedded query (`patients` with nested
`visits`) — one round trip and it does disambiguate, but pagination and
`count` over an embedded resource are awkward enough to obscure what the
query does.

**Consequences:** Two round trips per read, both primary-key or
index-covered. No information leak: because the lookup runs under RLS,
"doesn't exist" and "isn't yours" produce a byte-identical 404, the same
property the POST path already has. Verified against a running server —
clinician A requesting clinician B's real patient gets 404, not an empty
list.

---

## ADR-023 — Visit history ordering: `visit_date desc, created_at desc, id desc`

**Status:** Accepted — 2026-09-04

**Context:** `visits` carries two time columns with different meanings
(ADR-020): `visit_date` (clinical time, caller-supplied, backdatable) and
`created_at` (write time). A visit history has to pick one to order by. The
slice-3 review already established that an ordering whose sort key can tie
produces unstable pagination — rows repeated or omitted across pages.

**Decision:** Order by `visit_date desc`, then `created_at desc`, then
`id desc`. Clinical order is what a clinician reads a history in; the
secondary keys make the ordering total.

**Rejected:** `visit_date desc` alone — it matches the
`(patient_id, visit_date desc)` index exactly, but `visit_date` is a `date`,
so two visits on the same day tie, reintroducing precisely the pagination
bug slice 3 fixed. Also rejected ordering by `created_at` alone: it is
total already, but it sorts a backdated visit as if it happened on the day
the paperwork was typed, which is wrong on a clinical timeline.

**Consequences:** Ties cost a small sort step on top of the index scan, over
the tied rows only. This tie is directly testable, unlike slice 3's
`created_at` tie — `visit_date` is caller-supplied, so a test can force two
same-day visits and assert the entry-order tie-break, which
`visits.test.ts` now does.

---

## ADR-024 — `req.user` declared on Express's `Request`, not a parallel `AuthenticatedRequest` cast

**Status:** Accepted — 2026-09-04

**Context:** `requireAuth` attaches a clinician identity to the request, but
`user` is Diacify's invention — Express's `Request` type has never heard of
it. Every reader therefore cast first: `(req as AuthenticatedRequest).user!`,
at eight call sites across `patients.ts`, `rateLimit.ts` and two test files.
Flagged as a threshold question since slice 4 and deliberately left
undecided until the count justified touching every route file.

**Decision:** Declare `user` on Express's own `Request` via global
augmentation (`backend/src/types/express.d.ts`). Call sites become
`req.user!`. `AuthenticatedRequest` deleted.

**Rejected:** Keeping the cast — it is a per-call-site assertion that the
request is a type other than the one the compiler believes, repeated eight
times, and the first question any new reader asks about the file. Also
rejected a `requireUser(req)` helper that throws a named error when auth
hasn't run: on Express 4 (this project is on 4.22) a throw inside an `async`
handler is not caught, so the promise rejects, nothing responds, and the
request hangs until the client times out — strictly worse than the status
quo. That option becomes viable on Express 5, which auto-forwards rejected
handler promises.

**Consequences:** Honest about what it does *not* buy: `user` stays optional
— a request that skipped `requireAuth` genuinely has none — so handlers
still assert `req.user!`. This removes a lie, not a risk. What actually
prevents an unauthenticated handler reading `req.user` is `requireAuth`
being mounted once on the whole router (`server.ts`), so a new route
inherits auth by default and only a new *router* could miss it. Verified the
declaration is load-bearing rather than inert: a probe assigning
`req.user!.id` to a `number` fails typecheck with "Type 'string' is not
assignable to type 'number'" — an unloaded declaration would instead have
errored with "Property 'user' does not exist."

---

## ADR-025 — ML inference transport: exported JSON forest, traversed in the backend

**Status:** Accepted — 2026-09-04. Closes the question ADR-001 deferred.

**Context:** ADR-001 chose one application — inference in Node, training offline
in Python — but left *how* the model crosses the language boundary explicitly
unresolved, calling for "a quick spike before committing." Nothing had bridged
it: the trained model is a Python pickle, and the rebuild had no serving code on
either side. ADR-001's stated verification plan ("the same fixtures
`machine-learning/tests/test_model.py` already uses") turned out not to exist —
that file's four tests are all training-side; the serving fixtures it referred
to were legacy's, and legacy is not in this repository.

**Decision:** `machine-learning/serving_export.py` flattens the fitted forest
into JSON — per-node children, split feature, threshold and leaf distributions,
plus feature order, class order and the training-time medians. `backend/src/ml/`
walks it. The artifact is **committed** (unlike the `.pkl`, which stays
gitignored) and carries a content-derived version string.

Inference compares features as **float32** (`Math.fround`), because
scikit-learn casts `X` to float32 before comparing against a split threshold.

**Rejected:** ONNX (`skl2onnx` + `onnxruntime-node`) — 296 MB of
platform-specific native binary for one shallow forest, and an opaque artifact,
which is the one thing in this system nobody could then explain. `m2cgen`,
which transpiles a model to self-contained JavaScript and was the most
attractive option on paper — last released April 2022, Python ≤3.10, against
this project's Python 3.11 / scikit-learn 1.8. `ml2json` as a runtime
dependency — it proved the export works and is actively maintained against
exactly our scikit-learn version, but its format is a Python round-trip
envelope that has to be transformed for JavaScript anyway, so reading
scikit-learn's `tree_` arrays directly is strictly simpler. Keeping a Python
inference service — the fallback ADR-001 named, unnecessary once parity was
demonstrated.

**Consequences:** Bit-exact parity with scikit-learn, verified on all 662
dataset rows *and* on 500 rows constructed to sit inside the float32/float64
disagreement window. That second set is the finding that justified the spike:
**the real dataset passes with or without `Math.fround`**, so a fixture built
only from real data would have gone green while shipping a fault that
misroutes near-threshold values and can return a different risk category. Five
of those 500 rows change category when the cast is removed — confirmed by
removing it. Inference costs ~3 µs, so the model's cost is noise next to the
database round trip.

Retraining now has a second obligation: regenerate `parityFixture.json`, or the
backend's tests compare against the previous model's answers. The fixture
carries the model version and a test asserts the pairing, so a stale fixture
fails loudly rather than silently.

**Full reasoning:** the spike is reproducible from `machine-learning/
parity_fixture.py`; `backend/src/ml/forest.ts` carries the float32 rationale.

---

## ADR-026 — The prediction response carries no `top_factors`

**Status:** Accepted — 2026-09-04

**Context:** Legacy's `/predict` returned `top_factors`: the model's top three
**global** feature importances — the same three names for every patient, not a
per-patient explanation. `docs/phase-1-investigation.md` records that the
frontend presented them without that caveat.

**Decision:** Omit the field. Global feature importances describe the *model*,
not a patient, and they already live in `models/model_metadata.json`.

**Rejected:** Porting it as-is for parity — shipping a known-misleading
feature to match legacy. Per-patient SHAP explanations, which would be the
real fix — SHAP is Python-only, so adopting it would mean reversing ADR-001
for a field with no consumer yet (there is no frontend).

**Consequences:** If a UI later wants "what drives this model," it should be
served as model documentation, not as part of an individual's result. Revisit
the per-patient version only with an actual clinical requirement behind it.

---

## ADR-027 — `POST /api/visits/:id/predict` scores a stored visit and persists nothing

**Status:** Accepted — 2026-09-04

**Context:** ADR-018 established that model output gets its own table
referencing `visits.id`, once inference exists. Inference now exists. The open
questions were what the endpoint takes as input and whether this slice also
builds that table.

**Decision:** Score a visit already on file, addressed by its own id at
`/api/visits/:id/predict`. Compute only — nothing is written. `POST`, not
`GET`.

**Rejected:** Accepting a loose measurements payload — that is a stateless
calculator; reading a stored visit means the measurements were already
validated on write and that RLS decides whether this caller may score them.
Nesting under `/api/patients/:id/visits/:visitId/predict` — the visit id is
unique and ADR-017's join policy already scopes it, so the patient id would be
decoration. Building the scores table in this slice — the same reasoning
ADR-015 used to refuse bundling patient + first visit: this slice's one hard
problem is inference, and a table, its RLS policy and a write path are the
next one. `GET`, despite the computation being pure and deterministic — the
method would have to change to `POST` when persistence lands, breaking a
published contract for a slice's worth of REST tidiness.

**Consequences:** Calling it twice is safe and returns the same answer, since
nothing is stored and the model is fixed. No rate limiter, following the read
routes' precedent (ADR-016 named a *write* flood as its threat) — worth
revisiting when this starts writing. Until the scores table exists, a
clinician-facing UI would have to score on demand rather than read a stored
history, which is exactly the gap the next slice closes.
