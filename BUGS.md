# Bugs

Log of real bugs found during development — root cause, fix, and how we
prevent the same class of bug going forward. Newest first.

---

## classification_report crashes on a demographic subgroup missing a class

**Found:** 2026-09-01, writing tests for the bias audit
(`feature/ml-bias-audit`).

**What happened:**

The bias audit breaks the test set into subgroups (male/female,
under-40/40-60/over-60) and reports precision/recall/F1 per subgroup.
Both legacy and our first draft called `classification_report` with
`target_names=["Low", "Medium", "High"]` but no `labels` argument:

```python
classification_report(
    y_true_subgroup,
    y_pred_subgroup,
    target_names=["Low", "Medium", "High"],
    output_dict=True,
    zero_division=0,
)
```

`classification_report` infers which classes to report on from
whatever's actually present in `y_true`/`y_pred`, unless told
otherwise. If a subgroup happens to be small enough that one risk
category never appears in it (a real possibility - the age-bucket and
sex splits can be small), the inferred class count won't match the
3-item `target_names` list, and it raises:

```text
ValueError: Number of classes, 1, does not match size of target_names, 3.
```

Legacy never hit this in practice because its 133-row test set
happened to have all three classes in every subgroup - but the bug was
latent in the code either way, waiting for a smaller or less balanced
subgroup.

**Fix:**

Pass `labels` explicitly, so every report always covers all three
classes regardless of what a given subgroup happens to contain:

```python
# bias_audit.py
classification_report(
    [y_true[i] for i in indices],
    [y_pred[i] for i in indices],
    labels=[category.value for category in RiskCategory],
    target_names=_CLASS_NAMES,
    output_dict=True,
    zero_division=0,
)
```

**Prevention:**

- When slicing evaluation data into subgroups, don't assume every
  subgroup will contain every class - test with a subgroup deliberately
  small enough to be missing one. This bug was only found because the
  test fixtures were small (by design, for test speed), which is
  exactly the condition that triggers it.
- Any `classification_report`/`confusion_matrix` call operating on a
  subset of data (a subgroup, a fold, a single class of interest)
  should pass `labels` explicitly rather than relying on inference from
  that subset.

---

## Train/test leakage via imputation medians computed before the split

**Found:** 2026-09-01, while planning the train/test split for model
training (`feature/ml-train-test-split`).

**What happened:**

Some patients have missing values (e.g. no recorded BMI). To fill
those gaps, legacy computed the median BMI across all 662 patients,
then filled every gap with that number — before splitting the data
into "train" (for building the model) and "test" (for judging how
good it is):

```python
# train_model.py, main()
df, training_medians = load_and_preprocess_data(CSV_PATH)   # medians fit on all 662 rows
x, y, feature_columns = prepare_features(df)
x_train, x_test, y_train, y_test = split_data(x, y)          # split happens after
```

Legacy's order:
1. Fill in missing values using ALL 662 patients
2. THEN split into train (529) / test (133)
3. Train on train, judge on test

Because the medians used to fill missing values were computed from
the full dataset, the test set's own values influenced a statistic
that was then used to preprocess the training data too. The test set
was never fully "unseen" — a mild but real evaluation leak.

**Fix:**

`split.py::prepare_train_test_data` splits first, then fits
`imputation.Medians` and `features.RatioMedians` on the training rows
only, and reuses those same training-only statistics to transform
both splits:

```python
# split.py
def prepare_train_test_data(rows: Sequence[CleanRow]) -> TrainTestData:
    train_rows, test_rows = split_rows(rows)

    medians = imputation.fit(train_rows)
    train_imputed = [imputation.transform(row, medians) for row in train_rows]
    test_imputed = [imputation.transform(row, medians) for row in test_rows]

    ratio_medians = features.fit_ratio_medians(train_imputed)
    train_engineered = [features.engineer_features(row, ratio_medians) for row in train_imputed]
    test_engineered = [features.engineer_features(row, ratio_medians) for row in test_imputed]
    ...
```

Our order:
1. Split into train (529) / test (133) FIRST
2. Fill in missing values using ONLY the 529 train patients
3. Use that same fill-in number on the test patients too
   (never recompute it from test data)
4. Train on train, judge on test

Verified the fix actually takes effect by comparing the two medians
directly: fitting on all 662 rows gives a BMI median of `29.0`; fitting
on the 529 training rows only gives `28.7`. Different numbers confirm
the split is genuinely being respected, not just wired but silently
ignored.

**Trade-off accepted:** our reported accuracy won't be directly
comparable to legacy's own ~94.9% mean CV accuracy, since the
preprocessing itself now differs slightly between the two pipelines.

**Prevention:**

- Any `fit`-style function (one that computes a statistic from a
  dataset to reuse elsewhere — medians, encoders, scalers) must only
  ever be called on the training split, never on the full dataset,
  once a split exists. `imputation.fit` and `features.fit_ratio_medians`
  were deliberately built as separate `fit`/`transform` steps for this
  reason (see `context/current-feature.md`), rather than one-shot
  functions that recompute per call.
- When rebuilding a legacy pipeline step, don't assume the obvious
  call order — read the actual orchestration code (`main()`, or
  equivalent) to see what really runs before what. This bug was only
  found by tracing legacy's real execution order, not by inspecting
  individual functions in isolation.
