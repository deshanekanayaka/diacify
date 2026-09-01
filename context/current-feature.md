# Current Feature

**Feature:** ML model training and evaluation

## Status

In Progress

## Goals

Train and evaluate a risk-classification model on the preprocessed,
labeled dataset produced by the ML preprocessing pipeline (see
`docs/phase-1-investigation.md` and `context/progress.md`). Understand
every step — feature selection, train/test split, model choice,
hyperparameter search, evaluation methodology, bias auditing, and
persistence — rather than inheriting legacy's pipeline unexamined.

## Decisions made

- **Model**: `RandomForestClassifier`, matching legacy. Defensible for
  this problem (tabular clinical data, ~660 rows, 3-class
  classification): handles non-linear feature interactions natively,
  gives feature importances for free, and legacy's own numbers (~94.9%
  mean CV accuracy) show it already works well here.
- **Feature set**: legacy's exact 14 features (HbA1c, Age, Sex, BMI, BP
  systolic/diastolic, RBS, TG/HDL ratio, LDL/HDL ratio, Trig, HDL,
  Genetics, hypertension_flag, age×BMI interaction). `Chol`/`VLDL`/
  `social_life` stay excluded (legacy found no value); `genetics` stays
  in per an earlier decision — its real feature-importance ranking
  (once trained) will show whether it's pulling weight, rather than
  guessing now.

## Implementation plan

Bigger than a preprocessing slice — real statistical machinery, not
just pure parsing functions — so still built as small, test-first,
reviewed vertical slices, in this order:

1. Feature matrix construction (`CleanRow` + `EngineeredFeatures` +
   `RiskCategory` → a fixed-order feature vector)
2. Train/test split — critically, this is where `imputation.fit` and
   `features.fit_ratio_medians` move from running on the whole dataset
   to running on the training split only, closing a leakage gap that
   was deliberately deferred until a split existed
3. Baseline model + single train/test evaluation
4. Hyperparameter search (grid search, matching legacy's params)
5. Cross-validation (5-fold stratified, matching legacy)
6. Feature importance (this is also where `genetics`'s value gets
   decided with evidence)
7. Bias audit (by sex, by age bucket — matching legacy)
8. Persistence (model + feature order + imputation medians together)

**Done:**
- Feature matrix construction — `feature_matrix.py::to_feature_vector`, `FEATURE_NAMES` (PR #19)
- Train/test split, leakage-safe imputation/ratio-median fitting — `split.py::split_rows`, `prepare_train_test_data`, `TrainTestData` (feature/ml-train-test-split)

**Remaining:**
- Steps 3-8 above

## Notes

- Legacy's training pipeline (`train_model.py`, recovered from git
  history at commit `e3cfdad5`) is the reference implementation for
  this feature — its exact hyperparameter grid, split ratio/seed
  (80/20 stratified, `random_state=42`), and bias-audit groups (sex;
  age <40 / 40–60 / >60) are being preserved, since they're already
  validated choices, not just inherited defaults.
- The feature-matrix module will use our own established snake_case
  naming (`hba1c`, `sex_encoded`, ...) rather than reintroducing
  legacy's Pandas-style names (`HbA1c`, `Sex_Encoded`, ...).
- Checked legacy's actual call order (`main()` in `train_model.py`):
  it preprocesses (imputes, engineers features, labels) the *whole*
  662-row dataset first, and only splits 80/20 afterward for
  evaluation — meaning legacy's medians were computed using test rows
  too, a real (if minor) evaluation leak. Decided to fix this rather
  than reproduce it: `split.py::prepare_train_test_data` splits first,
  fits `imputation.Medians`/`features.RatioMedians` on the training
  rows only, then transforms both splits with those training-only
  statistics. Trade-off: our accuracy numbers won't be directly
  comparable to legacy's reported ~94.9% CV accuracy, since the
  preprocessing itself now differs slightly.
- `split_rows` stratifies by `labels.base_label_from_hba1c` (Stage A
  only), not the full two-stage `RiskCategory` — the full label needs
  imputed BMI/RBS/ratios, which must not be computed before the split
  exists. `base_label_from_hba1c` was extracted from `assign_label` as
  a pure refactor (no behavior change) specifically to make this
  possible without a second copy of the HbA1c thresholds.
- Verified against the full 662-row dataset: 529/133 split (≈80/20,
  all rows accounted for), and confirmed the leakage fix actually
  works — the train-only BMI median (28.7) differs from the
  full-dataset median (29.0).

## Context files

Read these first, every session:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/progress.md — completed features
- @context/current-feature.md refer to this if anything is unclear
