---
version: 1
slug: "frontend-src-pages-patientdetailpage-tsx"
primary_target: "frontend/src/pages/PatientDetailPage.tsx"
related_targets: []
---

## Direction contract

THESIS: The patient screen splits into its own mini chart-tabs (History / New Visit) — a chart having internal dividers, not just the drawer having dividers between patients.

OWN-WORLD: Same committed palette/materials as the patient list (kraft ground, cream tab surface, teal accent, monospace chart labels, flipped-tab radius). The two-item tab strip reuses the tab-shape language at a smaller scale. Raised: the scored risk result gets its own large, committed monospace readout the instant it lands — not a small inline tag. Raised: each past-visit row in History expands in place to show its full vitals, closing back into a compact tab rather than opening a second screen.

STORY: The clinician opens a patient, lands on History by default, switches to New Visit, enters vitals, submits, and sees the risk verdict rendered as a dedicated readout in the same view before it settles into History as a new dated entry.

FIRST VIEWPORT: Patient reference as a page heading; a two-tab strip (History | New Visit) below it in the tab-spine language; History showing past visits as a vertical list of expandable tabs, newest first.

FORM: Two-Tab Chart Split — dealt lead (index 5) of 7 on the grounded surface-composition list (seed key b5d27fe6, surface scope, operate mode); raised with two donations from competitive challengers (instrument-readout result, expand-in-place history) rather than replaced by them.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
