---
version: 1
slug: "frontend-src-pages-patientlistpage-tsx"
primary_target: "frontend/src/pages/PatientListPage.tsx"
related_targets: ["frontend/src/pages/PatientDetailPage.tsx","frontend/src/pages/RecordVisitPage.tsx","frontend/src/pages/NewPatientPage.tsx","frontend/src/pages/SignInPage.tsx"]
---

## Direction contract

THESIS: A risk score is a specimen result, not a status label — every row and verdict reads like a printed lab requisition, refusing generic pastel dashboard-kit cards and the retired folder-tab metaphor.

OWN-WORLD: White clinical ground, near-black ink. Daylight Clinic's teal/gold/red/grey risk triad stays canonical, each a leading "cap" swatch with its own fill pattern (solid/hatch/dot/dashed) — risk is never color-alone. Barcode-tick texture on printed surfaces. Monospace for clinical/identity figures, plain sans for chrome. Square corners, 1px rules, no shadows.

STORY: A clinician scans rows like labeled specimens — cap color+pattern read before the number; a verdict shows the current result plus trend against the last visit.

FIRST VIEWPORT: Patient list as full-width label rows (cap | reference | gender | last-seen | risk badge+score | actions); barcode rule above the verdict card; outlined filter pills; square "+ New patient" top-right.

FORM: Specimen Label, candidate 3 of 7, seed 775f310c, re-roll round 1 — raised past an instrument-panel challenger (trend, not just value) and a dance-notation challenger (color never alone).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
