# Tasks

Live task state, groomed weekly. One line per task: `- [ ] <task> (<phase/sprint>)`. Move done items to progress.md as one-line entries, do not accumulate them here.

## Now

- [ ] Decide and implement an imputation strategy for missing values (ML preprocessing pipeline) — blocked on a decision: which method (e.g. column median, computed once and reused, matching the legacy's train/serve parity pattern) and where it lives in the pipeline; also needs a separate decision for `fbs` (96.5% missing — a different problem from ordinary imputation)

## Later / parked

- [ ] Feature engineering: ratios, interaction terms, derived flags (unparks once imputation is decided and implemented)
- [ ] Label assignment logic (unparks once feature engineering is done)
- [ ] Model training and evaluation (unparks once labeling is done)
