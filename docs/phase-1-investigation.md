# Phase 1 — Deliverable 1A: What Exists

Investigation of the legacy codebase, cloned read-only to `../diacify-legacy` from
`https://github.com/deshanekanayaka/diacify` (main, 199 commits at time of writing).
Nothing in that clone was modified. Claims below were verified by reading the actual
source — file paths are cited throughout so you can check any of them yourself.

The README frames this project as a rebuild-in-place of an earlier university
final-year project that an examiner flagged for six defects (no backend auth, no
unique patient identity, no visit history, synthetic ML labels, ML-outage data loss,
no tests). The git history shows those six being fixed commit-by-commit, and a lot of
the "why" behind the current design only makes sense in light of that history.

---

## 1. Current architecture

Three independently-deployed services, no shared code between them:

```
┌─────────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│  Frontend        │  HTTPS │  Backend              │  HTTP  │  ML service        │
│  React + Vite    │───────▶│  Node/Express         │───────▶│  Python/FastAPI     │
│  (Vercel)        │  JWT   │  (was Railway; not    │ shared │  (was Railway)      │
│                  │        │   redeploying there)  │        │                     │
│                  │◀───────│                       │◀───────│                     │
└──────────────────┘  JSON  └──────────┬───────────┘ secret └────────────────────┘
       │                               │                              │
       │ Clerk session                 │ mysql2 pool                  │ pickle load
       ▼                               ▼                              │ at import
┌──────────────────┐        ┌──────────────────────┐                 ▼
│  Clerk            │        │  MySQL 8              │        ┌────────────────────┐
│  (identity        │        │  patients/visits/     │        │  RandomForestClass. │
│  provider, SaaS)  │        │  appointments/         │        │  (scikit-learn,     │
│                  │        │  audit_log/            │        │  trained from CSV,  │
│                  │        │  id_sequences         │        │  never committed)   │
└──────────────────┘        └──────────────────────┘        └────────────────────┘
```

- **Frontend**: React 18 + Vite, Tailwind + shadcn/Radix component library, Clerk
  React SDK for auth UI. `frontend/src/App.jsx`, `frontend/src/main.jsx`.
- **Backend**: Express app, single process, `backend/server.js` as entry point. Owns
  the only database connection in the system — the frontend never talks to MySQL or
  the ML service directly.
- **ML service**: a separate FastAPI process with its own auth (a static shared
  secret, not Clerk), reachable only from the backend, not from the browser.
- **Identity**: Clerk is the entire identity provider. There is no local `users`
  table, no password hashing anywhere in this codebase. A "user" is a Clerk
  `userId` string, stored in the database as `clerk_id`.

All three services are built and deployed independently (separate Dockerfiles,
separate CI workflows: `backend-ci.yml`, `frontend-ci.yml`, `ml-ci.yml`). Locally
they're wired together with `docker-compose.yml` (4 containers: `db`, `ml`, `backend`,
`frontend`).

**A deployment note, confirmed with you directly**: the README describes Railway as
the backend's deploy target, and `backend-ci.yml`'s deploy job posts to a secret
named `RENDER_BACKEND_HOOK` — you've confirmed the Railway trial ended and
disconnected, and you don't intend to redeploy there this time; you're considering
Render instead. So the README's Railway framing is legacy/stale, not a live target,
and the `RENDER_BACKEND_HOOK` secret name may simply have been future-facing or
half-migrated. This matters for the rebuild: deployment target is an open decision
for Phase 1B/architecture review, not something to inherit from the old README.
`machine-learning/nixpacks.toml` (a Railway-specific build config) hardcodes port
8000 while everywhere else the ML service's port is 8001 — you weren't sure why, and
since Railway/nixpacks won't be the deploy path this time, this file is likely dead
weight to drop rather than reconcile.

---

## 2. Current runtime flows

### Flow A — Add a new patient (`POST /api/patients`)

```
Browser → Clerk getToken() → axios POST + Bearer token
  → Express: helmet → cors → express.json → globalClerkMiddleware
  → route mount: readLimiter → requireClerkAuth (401 if no valid session)
  → writeLimiter (per-route, stricter bucket)
  → patientController.createPatient
      1. Zod validatePayload (patientSchema) — 400 on failure, DB/ML never touched
      2. scoreVisitWithMl(measurements) — calls ML BEFORE opening a DB transaction,
         specifically so a slow/dead ML service never holds a DB lock open
      3. open transaction:
         a. mint patient_id atomically via id_sequences upsert (PAT-YYYY-NNNN)
         b. INSERT patients
         c. INSERT visits (with ML-scored fields, or risk_category='pending' if
            step 2 failed/timed out)
         d. INSERT audit_log
         commit, or roll back all four together on any failure
      4. 201 { patient_id, visit_id, risk_score, risk_category, top_factors, ml_pending }
```

`scoreVisitWithMl` **never throws** — on any ML failure it returns a pending-shaped
object instead. This is the "visit is always saved, scoring can catch up later"
design, and it's the single most fault-tolerant part of the system.

### Flow B — Add a visit to an existing patient (`POST /api/patients/:id/visits`)

Same shape, but the order is reversed on purpose: ownership check → **insert the
visit row first** as `pending` → call ML → if it succeeds, a separate `UPDATE visits`
attaches the score. This path is *not* wrapped in one transaction (unlike create/
update), so a crash between the insert and the ML update leaves a genuinely-pending
visit — which is an accepted, recoverable state, not a bug: `POST /:id/rescore`
exists specifically to re-run ML against any visit still marked `pending`.

### Flow C — List patients for the dashboard (`GET /api/patients?sortBy=risk`)

One SQL query using a CTE with `ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY
visit_date DESC)` to get each patient's latest and previous visit, scoped by
`clerk_id` in two places (inside the CTE and in the outer `WHERE`). Computes, per
patient: a 5-point sparkline (via `JSON_ARRAYAGG`), and a `trend` derived by
comparing `risk_category` (not `risk_score`) between latest and previous visit, with
explicit special-casing for `pending` states so a "high → pending" visit doesn't
misread as "improving."

### Flow D — Rescore pending visits (`POST /api/patients/:id/rescore`)

Ownership check → select all `pending` visits for that patient → loop, calling ML for
each → on success, update the row; on failure, `continue` (stays pending, eligible
for the next rescore attempt). Returns `{ rescored, remaining }`.

### Flow E — Analytics (`GET /api/analytics`)

Three independent SQL queries scoped by `clerk_id`, each pivoted into a chart-ready
shape in JavaScript: risk-category migration over 12 months, average HbA1c per risk
category over 12 months, and a 10-point-band histogram of latest-visit risk scores.

### Inside the ML service (`POST /predict`, called only by the backend)

```
verify X-Internal-Secret header (403 if wrong/missing, 500 if server misconfigured)
→ Pydantic validation of PatientData (loose outer bounds + field_validators
   that clamp implausible values, e.g. BMI clamps to 70 instead of rejecting)
→ preprocess_patient_data: impute missing optional labs with medians shipped
   inside the trained model's pickle (so serving-time imputation matches
   training-time imputation exactly)
→ model.predict_proba(features) → 3-class probability vector [low, medium, high]
→ risk_score = (0.5 * P(medium) + 1.0 * P(high)) * 100   — continuous, for ranking
→ risk_category = CLASS_LABELS[argmax(probabilities)]     — discrete, for display
→ low_confidence = max(probabilities) < 0.55
→ top_factors = top 3 GLOBAL feature importances (same for every patient — not
   personalized, not SHAP-based)
→ 200 RiskPrediction { risk_score, risk_category, confidence_low/medium/high,
   low_confidence, top_factors }
```

The **score and the category are deliberately never derived from each other** — this
is the single most bug-fixed piece of logic in the whole codebase (see §9).

---

## 3. Current domain model

Concepts that actually matter, independent of table names:

- **Clinician** — not a modeled entity in this codebase at all. It exists implicitly
  as "whoever `clerk_id` identifies." There is no clinician profile, role, or
  permission level — every authenticated Clerk user is, functionally, a clinician
  with full CRUD over *their own* patients and nothing else.
- **Patient** — a stable identity (`PAT-YYYY-NNNN`) plus a small set of fields that
  rarely change: sex, social life, genetics. A patient has no date of birth and no
  single "age" — age is captured per visit, not per patient, because age changes and
  a visit is a point in time.
- **Visit** — the actual unit of clinical observation: one set of measurements
  (blood pressure, cholesterol panel, HbA1c, BMI, RBS) taken at one point in time,
  plus the ML output attached to that specific observation. Visits are effectively
  append-only — nothing in the codebase updates a past visit's measurements, only
  attaches a score to it after the fact.
- **Risk score vs. risk category** — two conceptually distinct outputs from one
  model call, deliberately kept separate:
  - `risk_score` (continuous, 0–100): a *ranking* number, used to sort/prioritize
    patients against each other. Formula: `50% weight on P(medium) + 100% weight on
    P(high))`.
  - `risk_category` (discrete: low/medium/high/pending): a *classification* label,
    always taken directly from the model's most-probable class — never re-derived
    from the score via a threshold/band.
  This separation exists because an earlier score formula could produce a
  confidently-Low patient with a *higher* number than a borderline-Medium patient,
  inverting a prioritized list. Two dedicated regression tests in
  `machine-learning/tests/test_model.py` pin both directions of this bug from ever
  recurring.
- **Pending** — a third state, distinct from low/medium/high, meaning "this visit's
  measurements are saved, but the ML service has not yet successfully scored it."
  It is a first-class value the domain has to handle everywhere (sorting, trend
  computation, dashboards), not an error state.
- **Trend** — derived by comparing the *category* (not the score) of the latest visit
  against the previous one, with `pending` treated specially in both positions so it
  never falsely reads as improvement or deterioration.
- **Top factors** — global model feature importances, not a per-patient explanation.
  The same three factor names appear for every patient regardless of their own
  values. This is a real, documented limitation, not a bug — but the UI's literal
  copy ("Top Contributing Factors") doesn't communicate that limitation to a
  clinician reading it.
- **Appointment** — a scheduling record tied to a patient, independent of visits (the
  `visit_id` foreign key on `appointments` exists in the schema but the app never
  actually populates it — appointments and visits don't get linked in practice).
- **Audit log entry** — a fact ("this clinician did this create/update/delete to this
  patient at this time"), kept deliberately without a foreign key to `patient_id` so
  the audit trail survives even after a patient is deleted.

---

## 4. Current database model

MySQL 8. Five tables, all scoped to a clinician via `clerk_id` (either directly or
through a join to `patients`).

```
patients
  patient_id   VARCHAR(20) PK        -- e.g. "PAT-2026-0001", app-generated, not
                                          auto-increment
  clerk_id     VARCHAR(100) NOT NULL -- owning clinician; scoping key everywhere
  sex          VARCHAR(10) NOT NULL
  social_life  VARCHAR(10) NOT NULL
  genetics     VARCHAR(20) DEFAULT '0'   -- numeric (0-4) but stored as VARCHAR
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  INDEX idx_patients_clerk (clerk_id)

visits                                   -- one row per clinical observation,
                                          -- effectively append-only
  visit_id      INT PK AUTO_INCREMENT
  patient_id    VARCHAR(20) NOT NULL FK -> patients ON DELETE CASCADE
  visit_date    DATE NOT NULL
  age           INT NOT NULL             -- per-visit, not per-patient
  bp_systolic, bp_diastolic  DECIMAL(5,1) NOT NULL
  cholesterol, triglycerides, hdl, ldl, vldl, rbs  DECIMAL, nullable
  hba1c         DECIMAL(4,2) NOT NULL
  bmi           DECIMAL(5,2) NOT NULL
  risk_score    DECIMAL(5,2)             -- nullable while pending
  risk_category VARCHAR(10) DEFAULT 'pending'
  top_factors   JSON
  confidence_low/medium/high  DECIMAL(5,2)
  low_confidence  BOOLEAN DEFAULT FALSE
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  INDEX idx_visits_patient_id (patient_id)
  INDEX idx_visits_patient_date (patient_id, visit_date DESC)

appointments
  appointment_id  INT PK AUTO_INCREMENT
  patient_id      VARCHAR(20) NOT NULL FK -> patients ON DELETE CASCADE
  clerk_id        VARCHAR(100) NOT NULL   -- duplicated from patients.clerk_id,
                                              so this table can be scoped directly
  scheduled_date  DATE NOT NULL
  appointment_type VARCHAR(20) NOT NULL   -- 'routine' | 'urgent' | 'follow-up'
  notes           TEXT
  status          VARCHAR(20) DEFAULT 'scheduled'
  visit_id        INT DEFAULT NULL FK -> visits ON DELETE SET NULL  -- never
                                              actually populated by app code
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  INDEX idx_appointments_clerk (clerk_id, scheduled_date)

audit_log
  log_id          INT PK AUTO_INCREMENT
  clerk_id        VARCHAR(100) NOT NULL
  action          VARCHAR(20) NOT NULL    -- 'create' | 'update' | 'delete'
  patient_id      VARCHAR(20)             -- no FK, deliberately — survives
                                              patient deletion
  changed_fields  JSON
  timestamp       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  INDEX idx_audit_patient (patient_id)

id_sequences                              -- backs atomic PAT-YYYY-NNNN minting
  year      INT PK
  next_val  INT NOT NULL
```

**Lifecycle notes**:
- Deleting a patient cascades to `visits` and `appointments` (FK `ON DELETE
  CASCADE`), but the audit-log insert for the delete happens *outside* any
  transaction — if that insert fails, the delete has already committed with no
  rollback, unlike create/update which are fully transactional.
- `id_sequences` replaced an earlier `SELECT COUNT(*)`-based ID scheme that had two
  failure modes: a race between concurrent creates, and ID reuse after a delete.
  Both are covered by regression tests in `backend/tests/patients.test.js`.

**Migration history is fragmented** — worth flagging as a real, non-cosmetic issue:
- `backend/database/migrations/` (numbered `001`–`011`) is the real chronological
  schema history.
- `backend/database/initdb/` is a near-duplicate subset (`001`–`007`, renumbered)
  used only as MySQL's Docker Compose bootstrap. It does **not** include migration
  `011` (a data backfill that recomputes old risk scores to the current formula), so
  a fresh `docker compose up` starts on an old score formula baked into no data —
  harmless for an empty database, but the two directories are not kept in lockstep
  by anything automatic.
- `006`/`007`/`008` are a one-time ETL from a separate, older, flat-schema database
  (`diabetic_db`) into the current normalized schema. No single script reproduces a
  fully current schema+data state from scratch — CI only ever runs `001–005, 009,
  010`, never `006–008` or `011`.
- `backend/database/seed.sql` targets the *old* `diabetic_db` schema, is stale
  relative to the current schema, and hardcodes a real-format Clerk user ID
  (`user_3BUc8irbsRLEN45Gdo4jInGbnjW`) across all 10 demo rows — worth confirming
  with you directly whether that's a real account before this file is reused for
  anything.

---

## 5. Current ML pipeline

**Dataset**: the Erbil Diabetes Dataset (Mendeley, DOI 10.17632/3snnp89967.1),
committed to the repo as `machine-learning/Dabetics-dataset.csv`, ~662–666 rows
(train_model.py's own printed count and the metadata file both say 662; the raw file
has 666 data rows — the discrepancy wasn't traced to a specific line, worth
resolving in a rebuild rather than carrying forward unexplained).

**Preprocessing** (`train_model.py`), in order:
1. Fix a malformed genetics column name (literal embedded newlines and a typo,
   `"Fiamly \n1)father\n..."`), rename to `Genetics`.
2. Drop `Unnamed: 0`, `Visit_ID`, and `FBS` (FBS is 96.5% missing — 23/662 records —
   documented exclusion).
3. Parse `Age` (strip "Years"/"Year" text) and `BP` (split `"systolic/diastolic"`
   string) — and correct a **known dual-encoding bug**: earlier rows in the dataset
   store BP in different units than later rows (`systolic < 30` ⇒ multiply both
   values by 10 to normalize to mmHg). This same correction pattern reappears in
   `migrations/007_seed_visits.sql` for legacy seeded data.
4. Clip BMI to a plausible max of 70 (the raw data has one entry at 332.2 — a
   data-entry error).
5. Median-impute missing labs (Age, BP, BMI, RBS, HDL, LDL, Triglycerides) — the
   medians are captured and **shipped inside the trained model's pickle file**, so
   the serving side imputes with the exact same numbers used at training time.
6. Encode sex (male=1/female=0) and genetics (count of distinct affected relatives
   mentioned in a string like `"1-2-3"`).
7. Engineer four features: `TG_HDL_ratio`, `LDL_HDL_ratio` (both fall back to their
   own shipped training-time median when HDL≤0, to avoid a train/serve skew that
   previously existed), `hypertension_flag` (systolic≥140 OR diastolic≥90),
   `age_bmi_interaction` (age × BMI).
8. **Label assignment** — two-stage, never-downgrade rule:
   - Base label from HbA1c alone, per ADA 2025 thresholds: <5.7 low, 5.7–6.4 medium,
     ≥6.5 high.
   - Upgrade rule: if ≥2 of 5 secondary clinical flags are raised (hypertension,
     obesity, high RBS, high TG/HDL ratio, high LDL/HDL ratio), bump the label up by
     one class (capped at high).

**Features fed to the model (14)**: HbA1c, Age, Sex, BMI, BP systolic/diastolic, RBS,
the two lipid ratios, Triglycerides, HDL, Genetics count, the hypertension flag, the
age×BMI interaction. FBS, cholesterol, VLDL, and social life are deliberately
excluded (missingness, low documented predictive value, or non-clinical).

**Model**: `RandomForestClassifier`, grid-searched over depth/split/feature-sampling
hyperparameters, evaluated with 5-fold stratified cross-validation plus an explicit
bias audit by sex and by age bucket. Per the committed metadata: ~94.9% mean CV
accuracy, feature importance dominated by HbA1c and the TG/HDL ratio.

**Persistence**: the trained model, its feature name order, and its imputation
medians are pickled together (`models/random_forest_model.pkl`). This file is
**never committed to git** — it's excluded via `.gitignore` and is rebuilt from
scratch by `train_model.py` in every environment: local dev, CI (`ml-ci.yml`), and
the Docker image build itself (there's a dedicated fix commit for training the model
during Docker build specifically so the pickle exists at deploy time).

**Serving** (`machine-learning/app.py`, FastAPI):
- The only auth is a static shared secret (`X-Internal-Secret` header, compared
  against `ML_INTERNAL_SECRET`) — not JWT, not Clerk. It's meant to be identical on
  both the backend and this service, verifying "this call came from our own
  backend," nothing more granular than that.
- `POST /predict` takes a Pydantic-validated patient payload (loose outer bounds
  combined with field-level clamping — e.g. BMI's outer bound is intentionally wide
  so a value like 150 gets clamped to 70 by a validator instead of being rejected by
  the bound itself; there's a documented historical bug where tightening the bound
  directly caused legitimate-but-extreme inputs to 422 before the clamp ever ran).
- The `risk_score`/`risk_category` split described in §3/§9 happens here.
- `low_confidence` fires when the model's top class probability is below 0.55 — a
  replacement for a previous threshold of 0.40 that was **mathematically
  unreachable** with 3 classes (the argmax probability is always ≥ 1/3, and the
  lowest ever observed in the training distribution was ~0.51) — i.e., a feature the
  README advertised that could never actually fire in production. This is now
  regression-tested.
- `top_factors` returns the model's **global** feature importances (same 3 names for
  every patient), not a per-patient explanation (no SHAP/LIME). This is documented
  in code comments and the ML README, though the frontend's literal UI copy doesn't
  carry that caveat through to the clinician.

---

## 6. Current frontend/backend relationship

- The frontend never talks to MySQL or the ML service directly — everything goes
  through the Express API, authenticated with a Clerk-issued Bearer token attached
  per-request.
- There **is** a shared, correctly-configured axios client
  (`frontend/src/utils/axiosConfig.js`) with a response interceptor that detects
  network failures and drives a global "you're offline" banner — but it's used by
  only 3 of roughly 11 API-calling files. The rest (`PatientDetailPage.jsx`,
  `PriorityTable.jsx` for some calls, `Appointments.jsx`, `BookAppointmentModal.jsx`,
  etc.) each independently call `getToken()` and construct their own `axios`/`fetch`
  call with a locally-redeclared base URL and manually-attached `Authorization`
  header. Because of this, the global network-error banner only actually fires for
  the minority of calls routed through the shared client.
- `frontend/src/utils/schema.js` is a hand-maintained near-duplicate of the
  backend's Zod validation (`backend/utils/schema.js`), independently kept in sync by
  a human rather than shared as one module — and it has already drifted (two
  clinical warnings present on the backend, triglycerides and VLDL, are silently
  absent from the frontend's live-typing warnings).
- `frontend/src/lib/types.ts` — a set of TypeScript interfaces describing the API
  shape — does **not** match the real backend response in several field names
  (`patient_id` vs. an invented `id`, a `dob` field that doesn't exist anywhere in
  the schema, a `sex: "other"` option the backend's Zod enum doesn't allow, etc.). It
  reads as written against an earlier or intended schema and never reconciled. It
  should not be trusted as documentation of the real contract.
- The dashboard's "top contributing factors" bar display invents its own display
  percentages client-side (`[100, 75, 50, 25]` by list position) — the ML service
  only ever returns factor *names*, never per-factor weights, so this bar chart's
  apparent precision is a frontend fabrication layered on top of a global,
  non-personalized signal.

---

## 7. Current security model

- **Authentication**: Clerk-issued JWT session tokens, verified server-side via
  `@clerk/express`. No local password storage, no custom session table.
  `backend/middleware/auth.js` distinguishes three failure modes deliberately: a
  missing/invalid token → 401; the Clerk SDK itself being misconfigured (no secret
  key set) → 500; a genuine Clerk service outage → 503. All `/api/*` routes require
  this; only `GET /health` is public.
- **Authorization / data ownership**: enforced directly, inline, in every single
  query that touches `patients`, `visits`, or `appointments` — each one includes an
  explicit `WHERE ... clerk_id = ?` (or a join through `patients.clerk_id`), and the
  `clerk_id` value is always sourced from the verified token (`req.auth.userId`),
  never from the request body, query string, or URL. This was checked query-by-query
  across every controller, and it holds consistently. There is no separate
  "belongs-to-user" abstraction — it's inline in each query, which is simple but
  means a rebuild needs to be equally disciplined about it in every new query it
  writes, since there's no structural guardrail forcing the scoping to be there.
- **Service-to-service auth**: the backend-to-ML-service call uses one static shared
  secret in a custom header, not a token per request, not mTLS, not Clerk. This is
  reasonable given the ML service is not reachable from the browser and does no
  patient lookups of its own (it's a stateless scoring function), but it is a single
  static credential with no rotation mechanism visible anywhere in the codebase.
- **Secrets**: nothing hardcoded in application code — DB password, Clerk secret
  key, and the ML shared secret are all read from environment variables with no
  fallback to a real-looking default (DB password has no default at all; an unset
  value fails to connect rather than silently authenticating with something weak).
  `.env.example` only has placeholders. The one flagged item is
  `backend/database/seed.sql`'s hardcoded, real-format Clerk user ID across its demo
  rows (see §4) — not a credential, but a real-looking identifier worth confirming.
- **Rate limiting**: two tiers via `express-rate-limit` — a looser bucket (100/min/IP)
  on every `/api/*` request, a stricter one (20/min/IP) additionally on mutating
  endpoints. No auth-specific rate limiting (e.g., no separate throttle on repeated
  invalid tokens) — but Clerk owns the login/session-issuance surface, so that's
  arguably out of this codebase's scope.
- **Transport/headers**: `helmet()` is applied; CORS is an explicit origin allowlist
  (localhost dev ports + one configured production frontend URL), not a wildcard.

---

## 8. Current test model

**Backend** (`backend/tests/patients.test.js`, Jest + supertest, DB/axios/logger
fully mocked): thorough coverage of `patientController.js` — create/update/visit/
rescore flows, validation edge cases, the atomic ID-minting scheme (including a
concurrent-request scenario), transaction rollback on partial failure, and the full
trend-derivation matrix (6 cases). **Zero coverage** of: `appointmentController.js`
(no test at all — including no regression test for a documented, previously-fixed
overdue-appointment bug), `analyticsController.js` (no test at all), `deletePatient`,
`getPatientById`, the `auth.js` middleware's own behavior (all tests bypass it by
injecting a fake `req.auth`), and `rateLimiters.js`/`server.js`.

**ML service** (`machine-learning/tests/test_model.py`, pytest + FastAPI
`TestClient`): 8 tests, essentially all regression pins for specific historical bugs
— the score/category independence, the low-confidence threshold reachability, the
BMI clamp behavior, and imputation parity between training and serving. **Zero
coverage** of: the `/predict` endpoint's own auth behavior (no test for a missing/
wrong shared secret, or for the server-misconfigured case), the `model is None` → 503
path, general Pydantic validation failures beyond the BMI case, and `train_model.py`
itself has no unit tests (the label-assignment logic, the BP dual-encoding fix, and
the bias audit are only exercised indirectly through the trained model's behavior).

**Frontend**: no test files exist anywhere in the repo, and no test runner is
configured beyond ESLint + a Vite build check. The README's "before/after" table
states test counts for backend and ML but doesn't disclose that the frontend has no
automated tests at all.

---

## 9. What I don't understand yet

Resolved directly with you:

- **Deploy target**: the Railway/Render ambiguity is explained — the old Railway
  connection disconnected when its trial ended, and Railway isn't the plan for this
  rebuild either. Render is a candidate, but this is an open Phase 1B/architecture
  decision, not something settled here.
- **`seed.sql`'s hardcoded Clerk ID**: confirmed to be test data, not a real
  credential/account. No sensitivity concern.

Genuinely still open (you don't know either, or it wasn't fully resolved by your
answer — carrying these forward rather than guessing):

- Why `machine-learning/nixpacks.toml` hardcodes port 8000 against 8001 everywhere
  else. You don't know either. Since Railway/nixpacks won't be the deploy path this
  time, my recommendation is to just drop this file in the rebuild rather than
  reconcile it — but flagging it as a decision, not assuming it.
- Why `appointments.visit_id` exists as a foreign key the application never
  populates — unresolved; worth a conscious decision in Phase 1B (keep as a real
  feature to build, or drop the column).
- ~~The dataset row-count discrepancy (666 raw rows vs. 662 reported)~~ —
  **resolved during Phase 2, and it turns out to be my own error, not a real
  data issue.** I had counted "raw rows" with `wc -l` (667 physical lines, minus
  1 for a header, = 666), but the CSV's genetics column header contains 4
  literal embedded newline characters inside a quoted field (`"Fiamly \n1)
  father\n2) mather \n3)uncle(mother's side)\n4)uncle(father's side) "`), so the
  header alone spans 5 physical lines, not 1. `wc -l` doesn't understand CSV
  quoting and counts each embedded newline as a line break; `pandas.read_csv`
  (and any real CSV parser) correctly treats it as one header field. Parsing the
  file properly gives exactly 662 data rows, 16 columns, zero duplicates — which
  matches what `train_model.py` reported all along. There was never a
  discrepancy in the data; there was a discrepancy in how I was told to count
  it. Worth remembering as a concrete example of why "trace actual execution,
  don't assume" applies to my own claims too, not just the legacy code's.
- Whether `migrations/` vs. `initdb/` duplication is intentional or accidental drift
  — unresolved; the rebuild should collapse this into one source regardless.
- Whether `frontend/src/lib/types.ts` was ever load-bearing — unresolved; treated as
  untrustworthy either way.
- Whether the ML service's `BACKEND_ORIGIN` CORS default mismatch has ever mattered
  in practice — unresolved; my read remains that it's dead config.

---
---

# Deliverable 1B: Assessment and Options

Everything below is judgment built on top of Deliverable 1A's facts. Where I'm
uncertain or where reasonable engineers could disagree, I've said so rather than
presenting it as settled.

## 10. Existing architectural problems, prioritized by impact

**High impact:**

1. **Ownership scoping has no structural enforcement.** Every query that touches
   `patients`/`visits`/`appointments` includes a hand-written `clerk_id = ?`. It's
   correct today (verified query-by-query in 1A), but nothing in the architecture
   *prevents* a future query from omitting it — the discipline lives entirely in
   the author's head at the moment they write each query. This is the kind of thing
   that's fine at one contributor and one controller file, and becomes a real
   cross-tenant data leak risk as the codebase grows. Highest priority because the
   failure mode is a security incident, not a crash.
2. **Frontend API-client fragmentation.** A correct, working shared client exists
   (`axiosConfig.js`) and is used by roughly a quarter of the call sites that need
   it. The rest hand-roll token attachment and a local base URL. This means the
   global network-error banner silently doesn't work for most of the app, and every
   new page is one copy-paste away from a fourth slightly-different version of the
   same twelve lines.
3. **Client/server validation duplication has already drifted.** Two Zod-like
   schemas, maintained by hand, already disagree (triglycerides/VLDL warnings exist
   server-side but not client-side). This isn't a one-time bug, it's a standing
   process that will keep producing this exact class of bug.
4. **Migration history is not reproducible from a clean state.** No single script
   takes an empty database to the current schema+behavior. `initdb` and
   `migrations` are hand-kept-in-sync duplicates that have already diverged
   (`initdb` is missing `011`). This is an operational risk for anyone (including
   future-you) trying to stand up a fresh environment.
5. **Test coverage gaps track the app's actual risk surface poorly.** The
   best-tested code (`patientController.js`, the ML scoring logic) is also the code
   with the most historical bugs fixed — so the tests exist. But
   `appointmentController.js` and `analyticsController.js` have zero coverage
   despite `appointmentController.js` having at least one documented historical bug
   (the overdue-flag issue) with no regression test protecting the fix.

**Medium impact:**

6. **Inconsistent transactional discipline.** `createPatient`/`updatePatient` wrap
   everything in one transaction; `createVisit` deliberately doesn't (a reasoned
   trade-off, documented); but `deletePatient`'s audit-log insert is outside its
   transaction with no stated reason — this one looks like an oversight, not a
   decision, unlike `createVisit`'s.
7. **Dead/confusing files accumulate silently.** `lib/types.ts` (wrong contract),
   `TestComponents.jsx` (orphaned dev page), `StatCards.jsx`/`Header.jsx` (built but
   unused), the nixpacks port mismatch. None of these break anything today, but
   each one is a small tax on "can I trust what I'm reading," which is directly
   opposed to the goal of this rebuild.

**Low impact:**

8. `backend/utils/logger.js` creates a directory as an import-time side effect
   (works today, fragile if the process's CWD ever changes).
9. The patient-detail "sparkline" widgets are single-value stubs that always
   render as a flat line — an unfinished feature, not a bug, but worth a decision
   either way rather than quietly shipping half a feature indefinitely.

## 11. Accidental complexity

- **Three overlapping patient-form components** (`AddPatientModal.jsx`,
  `EditPatientModal.jsx`, `PatientFormModal.jsx`) where the larger one looks like an
  attempted consolidation that the other two weren't fully migrated onto. I did not
  fully trace whether the two smaller ones still contain duplicate logic — worth
  confirming directly during the rebuild rather than assuming.
- **Manually duplicated auth-attachment code across 8+ frontend call sites**, when
  the abstraction that would remove it (a shared client with a request interceptor)
  already exists and is already used elsewhere in the same codebase. This is
  accidental complexity in the purest sense: the deep module exists, it's just not
  being called.
- **`clerk_id` scoping applied twice in one query** (`getAllPatients`'s CTE scopes
  it once inside the window-function subquery and again in the outer `WHERE`) — the
  code's own comment flags this as redundant. Small, but a real instance of
  defensive-but-not-understood duplication.
- **Two migration directories carrying the same schema.** Nothing about the
  Docker-Compose bootstrap requirement (`initdb`) inherently required a second,
  separately-maintained copy of the schema history — a single migration runner that
  Compose invokes on startup would have avoided the duplication entirely.
- **The `diabetic_db` one-time ETL (`006`–`008`) lives inside the "current"
  migrations directory** as if it were part of the ongoing schema history, when
  it's actually a one-time historical event that will never run again. Keeping it
  in the same numbered sequence as `009`/`010`/`011` gives it more architectural
  weight than it has.

## 12. Things I probably cannot explain in an interview

Being direct, per your instruction — these are the things that, if an interviewer
pushed on them, the honest answer is "I don't know" or "there's no good reason,"
not "here's the trade-off":

- Why `appointments.visit_id` exists as a real foreign key that the application
  never populates. There's no defensible answer available right now — it's either
  a half-built feature or a column that should never have shipped.
- Why two migration directories exist instead of one. There's no architectural
  reason for it — it's an artifact of how the Docker bootstrap need was solved.
- Why the frontend re-implements the same authenticated-request pattern in a dozen
  places when a correct shared client already exists elsewhere in the same
  codebase. This is the one that would concern me most in an interview, because
  it's not a subtle domain trade-off — it's an existing solution not applied
  consistently, and it doesn't have a clinical or business justification.
- Precisely why the ML training dataset shows 666 rows in the raw CSV but 662 in
  the training script's own reported count — still unresolved from Deliverable 1A,
  and "I dropped one column" doesn't account for a row-count difference. This is a
  real, unclosed loop.
- Why `nixpacks.toml` hardcodes a different port than every other reference to the
  ML service. Neither of us has an explanation, and it's about to become moot once
  Railway/nixpacks are out of the picture — but "we don't know why this exists" is
  a real answer worth being honest about rather than papering over.

Worth saying explicitly: the risk-score/risk-category split, the fault-tolerant ML
integration pattern, and the label-assignment clinical logic are all genuinely
well-reasoned and well-tested — those are *not* on this list, and you should be
able to explain all three confidently once you've internalized them, because the
reasoning is sound and it's already written down in comments, tests, and commit
history.

## 13. Things worth preserving

- **The ownership model's actual behavior** (never trust `clerk_id` from the
  client, always source it from the verified token) — the *rule* is right even if
  the *enforcement mechanism* (manual, per-query) is what needs rethinking in §15.
- **The fault-tolerant ML integration pattern**: score-before-transaction for
  patient/visit mutation so a slow ML service can't hold a DB lock; persist-then-
  score-async for standalone visit creation so a visit is never lost to an ML
  outage; an explicit `pending` state with a dedicated recovery path
  (`rescore`). This is the strongest piece of engineering in the codebase and
  should be preserved conceptually regardless of what language/runtime it ends up
  in.
- **The risk-score-vs-risk-category independence** as a domain rule: a ranking
  number and a classification label, computed from the same model output but never
  derived from each other. This has cost real bugs to learn and is now protected by
  tests that name the exact failure mode they prevent.
- **The two-stage clinical labeling rule** (ADA HbA1c thresholds as the base,
  secondary-flag upgrade, never downgrade) — clinically grounded, cites a real
  standard, and is a reasonable, explainable piece of domain logic.
- **Train/serve parity via shipping imputation medians inside the trained
  model artifact** — a real, previously-learned lesson (there's a documented
  historical bug about the median-vs-zero skew) and a good general pattern for any
  ML service.
- **Audit log decoupled from `patient_id` via no foreign key** — a deliberate,
  correct modeling choice (a fact about what happened shouldn't disappear because
  the thing it happened to no longer exists).
- **The atomic ID-minting scheme** (`id_sequences` + `ON DUPLICATE KEY UPDATE`) —
  correctly solves a real concurrency bug that a naive `COUNT(*)`-based scheme had,
  and is regression-tested for both the race and the reuse-after-delete case.
- **The regression-test-per-bug discipline** visible in both `patients.test.js` and
  `test_model.py` — even though overall coverage has real gaps (§10), the *tests
  that do exist* are unusually well-targeted at real, previously-occurring failure
  modes rather than being generic/tautological.

## 14. Things worth replacing, and why

- **Manual per-query ownership scoping** → some structural mechanism that makes
  the "every patient-scoped query must filter by the authenticated clerk_id"
  invariant hard to violate by accident, not just correct by discipline today. See
  the decision in §15 — the "how" is a real architectural choice, not a given.
- **The fragmented frontend API-client pattern** → one authenticated client, one
  interceptor, used everywhere. Removes the duplication in §10/§11 and makes
  network-error handling actually comprehensive rather than accidentally partial.
- **Hand-mirrored client/server validation** → one schema as the source of truth,
  consumed by both sides (or validate only at the server boundary and have the
  frontend simply render whatever the server reports, rather than re-implementing
  the same rules twice).
- **Two migration directories** → one linear, idempotent migration history that a
  single command can replay from empty to current; the `diabetic_db` ETL archived
  separately as a historical record, not numbered alongside ongoing schema
  evolution.
- **`lib/types.ts`** → either delete it, or regenerate it mechanically from
  whatever the real backend contract becomes, so it's structurally impossible for
  it to silently drift again.
- **Dead/orphaned frontend files** (`TestComponents.jsx`, `StatCards.jsx`,
  `Header.jsx` if genuinely unused) → delete rather than carry forward.
- **The stubbed "sparkline" widgets** → either build the real multi-visit version
  or remove the widget; shipping a component that always renders a flat line isn't
  serving anyone.
- **`nixpacks.toml`** → drop; it's Railway-specific tooling for a platform you're
  not using this time.

## 15. The architectural decisions that genuinely matter

These are the ones where a different choice actually changes the shape of the
system — the rest is implementation detail that doesn't need your sign-off.

1. **One language/one app, or keep a separate ML runtime?** (This is `CLAUDE.md`'s
   D1, and it's explicitly not grandfathered in — I need your decision, not an
   assumption.)
2. **How is ownership scoping enforced structurally**, if at all, beyond "every
   query author remembers to add the WHERE clause"? Options range from "keep it
   manual but add a lint rule/code-review checklist" to "push it into a repository/
   data-access layer that makes the caller pass the clerk_id once and can't forget
   it" to "database-level enforcement (e.g., Postgres row-level security)."
3. **How does the frontend/backend contract stay in sync** going forward — shared
   types generated from one schema, an OpenAPI spec, or just disciplined manual
   duplication done better than the legacy version? This determines whether the
   `lib/types.ts` failure mode can structurally recur.
4. **Database engine**: stay on MySQL, or move to something else (e.g. Postgres)?
   Nothing I found is deeply MySQL-specific in a way that would resist porting
   (`JSON_ARRAYAGG` and window functions both have Postgres equivalents), so this is
   a real, low-urgency choice rather than a forced one.
5. **Deployment topology**, now that Railway isn't the target — this interacts
   directly with decision 1 (a single app is simpler to deploy on Render than three
   coordinated services with a shared internal secret).

Decision 1 is the one everything else hangs off, so I'd resolve that first before
the others.

## 16. Proposed target architectures

**Option A — Keep the three-tier polyglot shape, fix the internal problems.**
Node/Express backend, separate Python/FastAPI ML service, React frontend — same
shape as today, but with the migration history consolidated, the frontend API
client unified, and ownership scoping given a structural home instead of being
purely manual.
- *Pros*: preserves the existing, well-tested ML pipeline (scikit-learn, pandas,
  the whole feature-engineering/label-assignment logic) completely unchanged;
  lowest risk to the domain logic that's already been hardened through real bugs;
  Python remains the natural home for any future model retraining/experimentation.
- *Cons*: two runtimes to build, test, and deploy; a cross-language contract
  (Pydantic vs. whatever the Node side uses) that has to be kept in sync by hand,
  the same failure mode that already bit the Zod-schema duplication on the
  frontend; directly conflicts with `CLAUDE.md`'s stated default (D1) unless you
  consciously override it.

**Option B — One application; ML inference moves into it, training stays offline
in Python.** Single backend (language TBD — Node/Next.js or otherwise), which does
both the API/domain logic and the model *inference*. Training remains a separate,
occasional, offline Python step (the existing `train_model.py` script, run whenever
the model needs retraining) that produces a portable artifact — either exported to
a format the main app's language can load directly (e.g. ONNX for a JS runtime), or
by re-implementing the trained random forest's decision logic directly if that
turns out to be simpler than adding a model-serving dependency.
- *Pros*: satisfies D1 directly — one deployed application, one deploy target, no
  shared-secret service-to-service auth, no cross-language schema to keep in sync;
  the app already conceptually separates "train" from "serve" (the pickle is never
  committed and is rebuilt at build/deploy time), so this isn't inventing a new
  boundary, just moving where "serve" runs.
- *Cons*: real, one-time cost to port the *serving-side* feature engineering
  (BP-string parsing, ratio calculations, median imputation, argmax/score
  formulas) into a second language, or to introduce a model-export step (ONNX)
  that has its own fidelity risks; you'd want to regression-test the ported serving
  logic against the existing Python test suite's exact expected outputs before
  trusting it.

**Option C — One application, entirely in Python (training and serving both, plus
the API/domain layer).** Flip the primary language the other way: a Python web
framework (FastAPI/Django) hosts the API, database access, and the ML model
together; only the frontend remains a separate JS codebase.
- *Pros*: also satisfies D1; keeps ML training and serving permanently in the same
  language with zero export/porting risk, ever.
- *Cons*: means rewriting the currently-working, reasonably well-tested Express
  backend (auth middleware, ownership-scoped queries, transactional patient/visit
  writes, rate limiting) in a different language for no reason connected to the ML
  domain — none of that logic is ML-specific and gains nothing from being in
  Python. This is the highest-cost option for the lowest domain-specific benefit.

## 17. Recommendation

**Option B**, with the specific framing that training and serving were already
conceptually separate in the legacy system — the pickle is never committed and is
always rebuilt from the dataset at build time. Moving *inference* into the primary
app doesn't invent a new boundary; it just changes which language sits on the
serving side of a boundary that already exists. Training keeps using Python's
mature ML tooling, offline, exactly as it does today.

This satisfies `CLAUDE.md`'s D1 default without asking you to abandon the ML
tooling that's already been hardened through real, well-documented bugs (the label
logic, the imputation-parity fix, the BP-encoding fix) — that reasoning lives in
`train_model.py` and stays in Python. What moves is the comparatively small
`app.py` serving surface: feature construction from a request, `predict_proba`,
the score/category formulas, and the confidence threshold — all of which are
already precisely specified and regression-tested, which makes them safe to port
deliberately, one test at a time, rather than risky to touch.

I'd treat Option A as the fallback if, once we look concretely at exporting the
model (e.g., trying ONNX against the actual trained random forest), the fidelity or
tooling cost turns out to be worse than expected — that's worth a quick spike
before committing, not something to decide purely on paper.

---

```text
DECISION REQUIRED

Decision:
Keep the ML pipeline as a separate Python service (Option A), or bring model
inference into the same application as the rest of the backend, keeping training
as a separate offline Python step (Option B)? (Option C — an all-Python backend —
is on the table too, but costs a full backend rewrite for no ML-specific benefit,
so I'd only revisit it if you have a reason for it I haven't seen.)

Current situation:
Today there are two runtimes: a Node/Express backend and a Python/FastAPI ML
service, talking over HTTP with a static shared secret. The ML service loads a
scikit-learn random forest (trained offline, never committed to git, rebuilt at
every deploy) and does feature engineering + inference on each request.

Why it matters:
This is `CLAUDE.md`'s D1 — the target should default to one language/one app
unless you consciously decide otherwise, and the existing Python service is
explicitly not grandfathered in. It also has real downstream effects: it decides
whether there's a service-to-service secret to manage, whether there's a second
Dockerfile/CI pipeline/deploy target, and whether the frontend/backend/ML-service
contract has one schema language or two.

Option A — keep the separate Python ML service:
Lowest short-term risk (zero changes to already-hardened ML logic); Python stays
the natural home for retraining; but keeps two runtimes, two deploy pipelines, a
cross-language contract, and a shared-secret internal auth model going forward.

Option B — fold inference into the main app, keep training offline in Python:
One deployed application; satisfies D1; no internal service auth to manage; but
requires porting the serving-side feature engineering and inference to a second
language (or exporting the model to a portable format like ONNX) — a real,
one-time cost that needs to be validated against the existing Python test suite's
exact outputs before being trusted.

Recommendation:
Option B — the train/serve boundary already exists in the legacy system (the model
artifact is never committed, always rebuilt from the dataset), so this reframes an
existing boundary rather than inventing one, and it's the only option that
satisfies D1 without a wholesale backend rewrite.

What I need to decide:
A / B / something else — and if B, whether you want to spend a short spike trying
an ONNX export of the actual trained random forest before committing, to check
fidelity and tooling cost concretely rather than on paper.
```

Then STOP — waiting for your decision before Phase 2 or any further architecture
work begins.

---

## Decision D1 — resolved

**What we decided**: Option B. One application — Node.js for the backend
(including ML inference) and React for the frontend. Model *training* stays a
separate, offline Python step, exactly as it is today (the artifact is never
committed to git; it's produced by `train_model.py` and consumed by whatever loads
it at serve time).

**Why**: this satisfies `CLAUDE.md`'s D1 default (one primary language, one
application) without discarding the ML tooling that's already been hardened
through real, documented bugs — training keeps using Python/scikit-learn/pandas,
offline, where that tooling is genuinely the right tool. What moves into Node is
the comparatively small, precisely-specified serving surface: feature
construction from a request, `predict_proba`, the score/category formulas, and the
confidence threshold — all of it already regression-tested in
`machine-learning/tests/test_model.py`, which gives the port something concrete to
verify against rather than reimplementing from scratch and hoping.

**What we rejected**: Option A (keep the Python FastAPI service as a permanent
second runtime) — lower short-term porting cost, but leaves two deploy targets, a
cross-language contract, and a shared-secret internal-auth model in place
indefinitely, which is exactly the kind of standing duplication that already bit
the Zod-schema drift on the frontend. Option C (rewrite the whole backend in
Python too) — would have meant discarding a working, reasonably well-tested
Express backend for no reason connected to the ML domain.

**What I should understand**: the serving side of the ML pipeline (`app.py`) is
not the hard part of this system to port — the hard-won domain knowledge is in
`train_model.py` (the BP dual-encoding fix, the label-assignment rule, the median-
imputation-for-parity fix), and none of that is moving. Porting `app.py`'s
inference logic to Node is mechanical *if and only if* each ported function is
checked against the same fixtures `test_model.py` already uses — the risk isn't in
the concept, it's in silently reimplementing a formula slightly wrong (e.g.
transposing which class gets which weight in the risk-score formula) with no test
catching it.

**How I'd explain it in an interview**: "The legacy system already treated model
training and model serving as separate concerns — the trained model was rebuilt
from source data at every deploy, never committed. Once I noticed that boundary
already existed, moving where 'serving' physically runs was a much smaller,
lower-risk decision than it first looked, because I wasn't inventing a new seam in
the system, I was just changing which side of an existing seam ran in which
language — and I had an existing regression-test suite to port the ported logic
against."

**Still open, not yet decided** (from Deliverable 1B §15, items 2–5): how ownership
scoping gets enforced structurally, how the frontend/backend contract stays in
sync now that there's no cross-language ML contract to maintain, database engine
(stay on MySQL or move), and deployment topology on top of Render. These don't
block starting to think about the concrete shape of the Node backend, but they're
real decisions, not defaults — we should come back to them before or during Phase
2's first vertical slice, whichever comes first naturally.

Before touching any implementation: do you want the short ONNX-export spike
against the actual trained random forest first (to validate Option B's porting
cost concretely), or do you want to just port the serving logic function-by-
function in plain JS against the existing Python test fixtures, skipping ONNX
entirely?

---

## Decision D1a — scope of the rebuild, and the ML dataset

**What we decided**: this is a true ground-up rebuild, not a port. Nothing is
carried over from `diacify-legacy` mechanically — no migrations, no `app.py`
code, no committed model artifact, no schema files. Legacy code is reference
material only, used to understand what already works and what to avoid; every
file in the rebuild is authored fresh. This also makes the ONNX-vs-manual-port
question above moot — there is no legacy model artifact to port at all; the new
Node service will do its own feature engineering and load whatever model the
fresh, from-scratch training pipeline produces.

For the ML dataset specifically: **keep the Erbil diabetes dataset
(Mendeley DOI 10.17632/3snnp89967.1) as the sole training source for now.** We
looked concretely at augmenting it — candidates researched were NHANES (US,
CDC, high documentation quality, but a general-population survey rather than
diabetes-clinic-referred patients) and other Iraqi hospital datasets on Mendeley
(feature-compatible but same small-single-site risk profile as Erbil itself) —
and separately looked at what a UK dataset would require, since the app's
existing clinical thresholds already cite NICE/Diabetes UK guidance alongside
ADA. The credible UK sources (UK Biobank, CPRD, QResearch) all require a formal
application, an academic/institutional affiliation, and in most cases a fee —
not realistic for this project, so a UK dataset is off the table unless that
changes.

**Why**: adding a second dataset before we've even rebuilt and measured the
single-dataset baseline is speculative complexity — exactly what `CLAUDE.md`
says not to do ahead of evidence. Combining datasets from different populations
or unit systems (US mg/dL vs. UK mmol/L vs. whatever Erbil actually uses) risks
reproducing the exact bug class we already found *inside* Erbil's own data (the
BP dual-encoding inconsistency across its own rows). Better to build the fresh
pipeline, measure it honestly (including the subgroup weaknesses the legacy bias
audit already flagged, e.g. thin over-60 sample), and only reach for a second
dataset if that measurement shows a real, specific problem it would solve.

**What we rejected**: augmenting with NHANES or another Mendeley dataset now
(deferred, not ruled out — revisit if the rebuilt model's own evaluation shows a
generalization or subgroup-coverage problem); sourcing a UK dataset (blocked by
access/governance reality, not by preference).

**What I should understand**: dataset augmentation is not free — it trades a
smaller, single-consistent-source risk for a larger, cross-source harmonization
risk (units, population, labeling criteria). The right time to take on that
trade is when a concrete, measured gap justifies it, not speculatively.

**How I'd explain it in an interview**: "I kept the original single dataset
rather than combining it with something else up front, because the project had
already been burned once by silently mixing two different unit encodings within
one dataset. Before taking on the harder problem of harmonizing an entirely
different dataset's population and units, I wanted to actually measure whether
the rebuilt model needed more data — and I looked concretely at what a UK
dataset would require, and found the credible ones are access-gated in a way
that ruled them out for a project at this stage anyway."

---

With D1 and D1a settled, the concrete next step is starting Phase 2 on the ML
pipeline as the first vertical slice — rebuilding the dataset preprocessing,
labeling, and training from scratch in Python (understanding every
transformation this time, resolving the 662-vs-666 row-count question by
construction), before deciding whether the Node serving side needs the ONNX
spike or a direct port. Alternatively, if you'd rather nail down the other open
decisions from §15 first (ownership-scoping enforcement, frontend/backend
contract sync, database engine, deployment topology on Render) before writing
any code, that's a reasonable order too. Which do you want to tackle first?

---

## Decisions D2–D5 — resolved

### D2 — Ownership scoping enforcement: convention + lint/review

**What we decided**: keep `clerk_id` scoping manual and explicit in every query
(as it is today), backed by a lint rule and/or a review checklist item, rather
than hiding it behind a repository/data-access abstraction.

**Why**: I recommended a repository layer (one seam, structurally hard to
bypass), but you weighed it against this project's actual purpose — being able
to explain every line yourself — and judged that an abstraction which hides the
scoping pattern behind an interface works against that goal for a solo-developer
codebase at this scale. That's a legitimate trade-off, not a compromise: the
`CLAUDE.md` principle "don't introduce abstractions that don't earn their
existence" cuts in favor of explicit-and-visible here, given the project's
stated goal.

**What we rejected**: a repository/data-access layer (structurally stronger, but
adds an abstraction whose main job is to hide something you specifically want to
keep visible) and Postgres row-level security (real defense-in-depth, but
premature given the primary mechanism is staying manual, and adds session-context
complexity to every connection for a guarantee we're not otherwise trying to
enforce at that layer).

**What I should understand**: the actual risk this leaves open is unchanged from
what Deliverable 1B flagged — a future query that forgets the `WHERE clerk_id =
?` clause is a cross-tenant data leak, not a crash, so it fails silently. The
lint rule/checklist is the only thing standing between "correct by discipline"
and "correct by construction." Worth writing that lint rule for real during
Phase 2, not treating it as a someday-task.

**How I'd explain it in an interview**: "I considered a repository layer that
would make the ownership check impossible to omit, but decided against adding
that abstraction because the project's goal was for me to understand and be able
to explain every query, and a layer that centralizes and hides the scoping logic
works against that. I accepted the residual risk and mitigated it with a lint
rule instead of an architectural guardrail."

### D3 — Frontend/backend contract: one shared schema, single source of truth

**What we decided**: a single schema (Zod, per `CLAUDE.md` D2's TypeScript
guidance) lives in one place and is imported by both the Node backend and the
React frontend; TypeScript types are inferred from it (`z.infer`), never
hand-duplicated.

**Why**: this was already the cheapest correct option once D1 put both sides in
one language — the exact drift we found in Phase 1 (frontend's `checkWarnings`
missing the triglycerides/VLDL branches the backend has) becomes structurally
impossible if there's only one copy of the rule to begin with.

**What we rejected**: an OpenAPI spec with generated clients (more tooling and
indirection than a one-frontend/one-backend system needs) and "no shared
contract, server validates only" (would have cost live client-side validation
feedback while a clinician is typing — a real UX regression).

**What I should understand**: this decision only became this cheap because of
D1. If we'd kept a separate Python ML service, this contract-sync problem would
still exist between Node and Python — collapsing to one language didn't just
simplify deployment, it also structurally removed a whole class of drift risk.

**How I'd explain it in an interview**: "Client and server validation had
already drifted in the legacy app because they were two hand-maintained copies
of the same rules. Once we committed to one language for the whole app, sharing
a single schema module stopped being a nice-to-have and became close to free —
so there's no longer a second copy that can silently fall out of sync."

### D4 — Database engine: stay on MySQL

**What we decided**: keep MySQL rather than moving to Postgres.

**Why**: your call to stay with what's already understood. I recommended
Postgres specifically because Render manages it natively (backups, scaling)
while MySQL on Render means self-hosting on a persistent disk — that
consequence stands and isn't changed by this decision, so it's a real cost
being knowingly accepted, not a wash.

**What we rejected**: Postgres (native Render management, and a future option
for row-level security) — rejected in favor of continuity with the schema
already understood from Phase 1, not for a technical reason that outweighs the
managed-hosting benefit.

**What I should understand, and what to do about it**: self-hosting MySQL on
Render means *you* own backup scheduling, version upgrades, and disk sizing.
This needs to be a real, deliberate piece of the deployment work in Phase 2 —
not something assumed to "just work" the way a managed database would. I'll
flag this again concretely when we get to deployment setup, so it doesn't get
lost between now and then.

**How I'd explain it in an interview**: "I kept MySQL for continuity with the
schema I already understood deeply from the investigation, accepting that it
meant self-managing backups and upgrades on Render rather than using their
native managed Postgres — a deliberate trade of operational simplicity for
continuity, not an oversight."

### D5 — Deployment topology: Render backend + Vercel frontend

**What we decided**: split deployment — Node backend (+ MySQL) on Render, React
frontend on Vercel, matching the legacy app's frontend deploy target.

**Why**: you want the React app to be recognizably, independently deployed
somewhere that clearly reads as "a real React deployment" — Vercel is the
standard, legible place for that. That's a legitimate reason for a project meant
to demonstrate what you built, not just to run.

**What we rejected**: all-Render (simpler single-provider setup, but doesn't
serve the demonstration goal as clearly) and single-process-serves-both
(fewest moving parts, but couples frontend/backend deploy cadence and loses
Vercel's edge caching — and undermines the "visibly separate React app" goal
even more than all-Render would).

**What I should understand**: this reintroduces a real CORS boundary between
two separately-hosted origins (frontend on a Vercel domain, backend on a Render
domain) — something the legacy app already had to configure correctly
(`backend/server.js`'s origin allowlist) and something the rebuild needs to get
right again, not inherit for free.

**How I'd explain it in an interview**: "I split frontend and backend across
two providers deliberately, even though a single provider would have been
operationally simpler, because I wanted the React deployment to be independently
visible and recognizable rather than folded into the same service as the API."

---

**Documentation note**: per `CLAUDE.md` §8, meaningful decisions like these
should be recorded as ADRs. I haven't created a `docs/adr/` structure yet
because `CLAUDE.md`'s own Phase 2 process (§4, step 12) ties ADR updates to
each vertical slice of actual implementation work, not to the investigation
phase — so I'd suggest formalizing D1–D5 as proper ADR files once Phase 2's
first slice branches, rather than creating ADR infrastructure now for a phase
that's about to end. Flagging this so it doesn't get silently skipped.

---

All of Deliverable 1B's architecturally-significant decisions (D1, D1a, D2–D5)
are now resolved. Phase 1 is complete. The next step is Phase 2, starting with
the first vertical slice — per your earlier choice, that's the ML pipeline
rebuild (dataset preprocessing, labeling, and training, from scratch, in
Python). Per `CLAUDE.md` §4, that starts with explaining the problem and
agreeing the design for that first slice specifically, not writing code yet.
Ready to start there when you are.

---

## Decision D6 — Identity and database platform: Supabase (Auth + Postgres), superseding D2/D4/D5

**What we decided**: use Supabase for both Postgres hosting and authentication,
replacing Clerk and replacing the earlier MySQL/self-hosting plan. Specifically:
- **Database**: Supabase-managed Postgres (supersedes D4's "stay on MySQL" —
  the self-hosting concern that decision accepted no longer applies, since
  Supabase manages the instance).
- **Auth**: Supabase Auth, not Clerk. Users live in `auth.users`, inside the
  same Postgres database as the domain tables — the ownership key becomes a
  real foreign key (e.g. `clinician_id UUID REFERENCES auth.users(id)`)
  instead of Clerk's opaque, loosely-coupled `clerk_id` string.
- **Ownership scoping**: Postgres Row-Level Security keyed on `auth.uid()`,
  reversing D2's "convention + lint only" decision now that Postgres/Supabase
  make RLS the idiomatic, natively-supported mechanism rather than an
  awkward bolt-on.
- **Tier**: Supabase free tier for now (accepting the trade-offs below).
- **Deployment topology** (supersedes D5's Render+MySQL assumption): Render
  (Node backend) + Vercel (React frontend) + Supabase (Postgres + Auth) — three
  providers, not two.

**Why**: reframed by you as a learning opportunity, not just an architecture
choice — and on that basis it's a clear win, not just a lateral move. Clerk is
a fully managed black box: the app calls one middleware function and trusts an
SDK's verification of a token Clerk issued, with no visibility into password
handling, session issuance, or token mechanics. Supabase Auth puts you much
closer to the real mechanics: `auth.users` is a real, queryable table in your
own database; you call `signInWithPassword` yourself and handle the returned
JWT directly rather than delegating to a hosted component; and choosing RLS
means writing real SQL policies against `auth.uid()` — database-level access
control, a level deeper than a `WHERE` clause in application code. This also
gives the ownership model a real foreign-key constraint instead of an opaque
string, which is a genuine data-modeling improvement independent of the
learning goal.

**What we rejected**: Clerk (polished, hosted, fast to integrate, but a black
box that teaches integration skills rather than auth mechanics — directly
opposed to the stated goal here); self-hosted MySQL on Render (D4's original
call, superseded because Supabase removes the backup/upgrade burden that
decision had knowingly accepted); the repository-layer and convention-only
options from D2 (superseded now that RLS is both idiomatic for the platform
and more educational); Supabase Pro tier ($25/mo, always-on, backed up) — free
tier accepted instead, meaning the project will pause after 7 days of
inactivity and has no automated backups.

**What I should understand**: RLS is also a well-documented source of real
vulnerabilities when policies are subtly wrong — Postgres does not enable RLS
by default per table, and a missing policy, or an update policy missing
`WITH CHECK`, fails in the dangerous direction (open, not closed). This isn't a
reason to avoid it — it's exactly the kind of mechanism worth understanding
deeply rather than trusting by inspection, which is why a deliberate
cross-tenant access test (clinician A must never be able to read/write
clinician B's patients) needs to be one of the first tests written once the
schema exists, not an afterthought. Separately: the free tier's 7-day pause
means a cold-start delay if this is shown to someone (a recruiter, an
interviewer) after a week of inactivity, and "no backups" is a real, accepted
data-loss risk for whatever demo data ends up in it — both consciously
accepted trade-offs, not oversights, revisit if this needs to be reliably
demoable on demand.

**How I'd explain it in an interview**: "I chose Supabase over Clerk
specifically because I wanted to understand auth mechanics, not just integrate
a vendor — Supabase puts the user table, the JWT, and the access-control
policies directly in front of me instead of behind a hosted black box. That
also let the ownership model become a real foreign key instead of an opaque
string, and let me enforce tenant isolation with Postgres row-level security
instead of a manually-repeated WHERE clause — which is idiomatic for the
platform and, because RLS fails open if misconfigured, something I made sure
to test explicitly rather than assume was correct by inspection."
