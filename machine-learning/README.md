# Machine Learning

Rebuilds Diacify's diabetes risk-classification pipeline from raw CSV
to a persisted, evaluated model — one small module per concern, each
test-first, each verified against the real 662-row dataset. See
`context/current-feature.md` and `context/progress.md` at the repo
root for the design decisions and trade-offs behind this code; see
`BUGS.md` for real bugs found (and fixed) along the way.

## Reading order

The pipeline runs top to bottom. Each module only depends on the ones
above it.

| # | Module | Purpose | Key exports |
|---|---|---|---|
| 1 | `dataset.py` | Load the raw CSV with a clean header | `load_raw_dataset` |
| 2 | `clinical_fields.py` | Parse each raw column to a typed value | `parse_age`, `parse_blood_pressure`, `parse_bmi`, `parse_lab_value`, `parse_rbs`, `parse_sex`, `parse_social_life`, `parse_genetics` |
| 3 | `assemble.py` | Combine the field parsers into one clean row | `CleanRow`, `parse_clinical_row` |
| 4 | `imputation.py` | Fill missing fields with training-time medians | `Medians`, `fit`, `transform` |
| 5 | `features.py` | Derive clinical ratios, flags, and interactions | `EngineeredFeatures`, `RatioMedians`, `fit_ratio_medians`, `engineer_features` |
| 6 | `labels.py` | Assign the ADA 2025 risk label | `RiskCategory`, `assign_label`, `base_label_from_hba1c`, `CLINICAL_THRESHOLDS` |
| 7 | `feature_matrix.py` | Build the model's numeric input vector | `FEATURE_NAMES`, `to_feature_vector` |
| 8 | `split.py` | Split train/test with leakage-safe median fitting | `TrainTestData`, `split_rows`, `prepare_train_test_data` |
| 9 | `model.py` | Fit and evaluate a `RandomForestClassifier` | `EvaluationResult`, `fit_baseline_model`, `evaluate_model`, `to_training_matrix`, `to_label_array` |
| 10 | `hyperparameter_search.py` | Grid-search the model's hyperparameters | `PARAM_GRID`, `search_hyperparameters` |
| 11 | `cross_validation.py` | 5-fold stratified cross-validation | `CrossValidationResult`, `cross_validate_model` |
| 12 | `feature_importance.py` | Rank features by trained importance | `rank_feature_importance` |
| 13 | `bias_audit.py` | Check performance by sex and age subgroup | `audit_bias` |
| 14 | `persistence.py` | Save the model, medians, and training metadata | `ModelPackage`, `save_model_package`, `load_model_package`, `build_metadata`, `save_metadata` |

`train.py` runs all 14 in sequence — see below.

## Running the pipeline

```bash
pip install -r requirements.txt
python3 train.py
```

Trains on `data/erbil-diabetes-dataset.csv`, prints a summary, and
writes two artifacts to `models/`:

- `random_forest_model.pkl` — the trained model, feature order, and
  imputation medians, bundled together (gitignored — binary, rebuilt
  from source)
- `model_metadata.json` — a human-readable record of the run: dataset
  size, CV/test accuracy, per-class metrics, feature importances, bias
  audit, and the exact clinical thresholds used (committed — this is
  the audit trail)

## Tests

```bash
python3 -m pytest
```

Every module has a matching `tests/test_<module>.py`, testing pure
logic against small synthetic fixtures. Real-dataset verification
(missingness counts, accuracy numbers, distribution checks) happens
separately, ad hoc, and is recorded in `context/current-feature.md`
rather than committed as slow tests.
