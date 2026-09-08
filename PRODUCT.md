# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Already decided by ADR-036/037 (not an init-time choice): Vite + React
Router (`react-router-dom`), TypeScript, TanStack Query for data fetching.
Deployed as a static client-only bundle on Vercel, on its own origin,
talking to the Express backend only over CORS (ADR-006). No SSR, no
Next.js, no API routes in the frontend — the backend is the sole owner of
business logic, auth verification, and data access.

## Users

A solo clinician per account. There is no clinician-profile or role table
in the schema — ownership is just "whoever the auth token identifies," and
that's confirmed intentional, not an oversight: each clinician sees only
their own patients, no sharing, no clinic-wide view.

The clinician uses the app **live, during the patient visit** — vitals get
typed in while the patient is in the room, and the risk score is read back
immediately as part of the consult. This is a live-use, in-the-room tool,
not an after-the-fact charting or batch-entry tool: it shapes the frontend
toward fast, low-friction data entry and an immediately legible result,
not a dense review/reporting surface.

## Product Purpose

Diacify helps a clinician record a patient's clinical vitals during a
visit and get back a diabetes risk classification for that visit,
immediately, in the room. It exists so a clinician doesn't need a separate
calculator or a round trip to a lab/specialist to get a first-pass risk
read from vitals they already have on hand.

## Positioning

The risk score isn't a static rule-of-thumb calculator — it's a trained
RandomForestClassifier (Erbil diabetes dataset), hand-ported from
scikit-learn to Node with verified bit-exact parity, so the score a
clinician sees in the app is provably the same number the trained model
would produce, not an approximation. Combined with structural per-clinician
data isolation (Postgres RLS, not just application-level convention) and an
append-only assessment history (a retrain adds a new scored row rather than
silently overwriting a past judgement), the product's claim is that a
clinician's data and the model's verdicts on it are trustworthy artifacts,
not best-effort output.

## Operating Context

- Used during a live patient visit, most likely on whatever device is at
  hand in the exam room (this doesn't rule out tablet/mobile use — worth
  keeping layouts flexible rather than assuming a desk-bound desktop).
- A visit is logged against an existing patient (or a newly created one),
  and scoring happens automatically once the visit is recorded — the
  clinician doesn't take a separate "now score this" action.
- Patients are identified by a clinician-assigned `reference` (a short
  label like a chart number), not a legal name (ADR-038) — the product
  deliberately avoids holding real patient identity.

## Capabilities and Constraints

- No clinician roles or multi-user accounts today (see Users). If that
  changes, it's a real schema/product decision, not a frontend-only
  addition — flag rather than build around it speculatively.
- The frontend is intentionally thin: render, call the API, hold client
  state. It does not duplicate validation, scoring, or business rules that
  already live in the backend.
- No real clinician-entered data exists yet (per `context/tasks.md`) — the
  app has no production usage history to design empty/loading states
  against; treat "clinician's first patient" as a real, common case rather
  than an edge case.

## Brand Commitments

None. The visual world is fully open for this rebuild — "Diacify" is the
product name; no logo, palette, or tone carries forward from the legacy
app. Visual direction gets decided later, in new-work.

## Evidence on Hand

None. No screenshots, testimonials, case studies, or real clinician data
exist yet — future work must not fabricate any of these.

## Product Principles

- **Live-use speed over dense review.** The primary moment is a clinician
  entering vitals with a patient in the room — optimize for fast entry and
  an immediately legible result, not for surfacing everything at once.
- **The frontend doesn't re-decide anything the backend already decided.**
  Validation, scoring, and ownership rules live in the backend; the
  frontend renders them, it doesn't reimplement them.
- **No patient identity beyond what's needed.** The product works from a
  clinician-chosen `reference`, not a legal name — carry that restraint
  into any new patient-facing field.
- **Nothing is fabricated to look finished.** No demo data, testimonials,
  or screenshots stand in for real evidence, which doesn't exist yet.

## Accessibility & Inclusion

No formal standard or specific known user need was established at init
time — standard good practice (keyboard navigation, sufficient contrast,
semantic HTML) applies, but WCAG conformance isn't a confirmed requirement.
Revisit if a real requirement surfaces.
