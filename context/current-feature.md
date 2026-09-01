# Current Feature

**Feature:** ML preprocessing pipeline

## Status

In Progress

## Goals

Rebuild the ML data pipeline from scratch, understanding every
transformation, instead of inheriting the legacy code's mix of raw-data
quirks and undocumented preprocessing decisions (see
`docs/phase-1-investigation.md`). Produce a well-tested set of small, pure
parsing functions covering every raw column, assemble them into one
function that yields a clean, typed row, and decide + implement
imputation for whatever each parser leaves missing — all before feature
engineering, labeling, or training begins.

## Implementation plan

One pure function per raw field (or group of fields needing identical
treatment), each: test-first (red/green), verified against the full real
662-row dataset (not just fixtures), built and merged as its own small
branch/PR, documented with a brief docstring (`CLAUDE.md` §6). Decisions
with a real trade-off (plausibility bounds, malformed-value handling)
surfaced and agreed before implementation, per `CLAUDE.md` §2.

**Done:**
- Load raw dataset with a clean header — `dataset.py::load_raw_dataset` (PR #10)
- Parse age and blood pressure — `clinical_fields.py::parse_age`, `parse_blood_pressure` (PR #11)
- Parse and bound BMI — `clinical_fields.py::parse_bmi` (PR #12)
- Parse remaining lab fields, RBS floor — `clinical_fields.py::parse_lab_value`, `parse_rbs` (PR #13)
- Parse categorical fields — `clinical_fields.py::parse_sex`, `parse_social_life`, `parse_genetics` (PR #14)
- Assemble all parsers into one clean-row function — `assemble.py::parse_clinical_row`, `CleanRow` (PR #15)
- Decide and implement an imputation strategy — `imputation.py::fit`, `transform`, `Medians` (PR #16)
- Feature engineering: ratios, hypertension flag, age×BMI interaction — `features.py::fit_ratio_medians`, `engineer_features`, `RatioMedians`, `EngineeredFeatures` (feature/ml-feature-engineering)

**Remaining:**
- None — this was the last item in "ML preprocessing pipeline"; label assignment is next

## Notes

- Every parser is verified against the full real dataset, not just test
  fixtures — missing counts and value distributions checked against
  manual inspection each time.
- An isolated, pre-existing source-data error was found in BP (raw
  `"1.0/8.0"` scales to a still-implausible 10 mmHg systolic) —
  deliberately left unfixed at parse time; flagged for the
  imputation/assembly stage rather than guessed at here.
- Root-level `CURRENT_FEATURE.md`/`tasks/` (built by a separate,
  concurrent Claude session on this same repo) were consolidated into
  this file and `context/tasks.md`, then deleted, to avoid two competing
  tracking systems for the same work.
- `CleanRow` is a row-level, pandas-agnostic dataclass (Decision:
  `parse_clinical_row(raw: Mapping) -> CleanRow`, not a DataFrame-level
  function) — matches every parser's existing scalar-in/typed-out shape,
  keeps pandas confined to `dataset.py`. `Visit_ID` is deliberately
  dropped, not carried into `CleanRow` — nothing downstream needs a
  patient identifier.
- Verified against the full 662-row dataset: missingness is low (~0-4%)
  for every field except `fbs`, which was missing in 96.5% of rows
  (639/662). Decided to drop `fbs` entirely rather than impute it —
  median-imputing a column that's almost entirely absent would be
  fabricating data, not filling gaps. `CleanRow` no longer has an `fbs`
  field. `docs/phase-1-investigation.md` confirms the legacy pipeline
  reached the same conclusion, independently, for the same reason.
- Imputation is a `fit(rows) -> Medians` / `transform(row, medians) ->
  row` pair, not a one-shot function — deliberately matching the
  legacy's "ship training-time medians, reuse them at serving time"
  pattern (which fixed a real historical train/serve skew bug). We
  don't have a train/test split yet, so `fit` currently runs on the
  whole cleaned dataset; when a split exists, `fit` moves to the
  training split only and `transform`'s signature doesn't change.
- `sex` and `social_life` are not imputed — both are 0% missing in the
  real data, so there's no categorical-imputation behavior designed
  yet. Flagged as a gap if that ever changes.
- `genetics` is kept (not dropped, despite only 0.2% missing and
  uncertainty about its model value) and median-imputed like the other
  numeric fields, rounded to the nearest int since it's a discrete
  count. Whether it's actually useful is deferred to feature
  engineering / model training, where real evidence (feature
  importance) can decide it — not a guess made during cleaning.
- Feature engineering matches legacy's four features (TG/HDL ratio,
  LDL/HDL ratio, hypertension flag, age×BMI interaction) — these feed
  directly into the label-assignment upgrade rule, so building all
  four now keeps labeling unblocked next.
- The two ratios divide by HDL, so legacy added a fallback for HDL≤0
  (shipped training-time median instead of dividing) — itself a fix
  for a real historical train/serve skew bug. Checked: HDL≤0 doesn't
  occur anywhere in the real 662-row dataset (min 19.0), so this isn't
  a live data issue like FBS or the BP-unit bug — it's a defensive
  case for a malformed single served patient, built now anyway to
  mirror imputation's fit/transform train/serve-parity pattern.
  `RatioMedians`/`fit_ratio_medians` are a second, smaller instance of
  that same pattern, separate from `imputation.Medians` because they're
  fit on derived ratios, not raw fields.

## Context files

Read these first, every session:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md refer to this if anything is unclear
