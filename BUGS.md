# Bugs

Log of real bugs found during development — root cause, fix, and how we
prevent the same class of bug going forward. Newest first.

---

## `anon` had full table-level grants on `patients`, despite the migration only ever granting `authenticated`

**Found:** 2026-09-02, via a CodeRabbit review comment on PR #30
(`feature/patients-table-rls`), then independently confirmed against the
real project before trusting it.

**What happened:**

The `patients` table migration only ever wrote:

```sql
grant select, insert, update, delete on patients to authenticated;
```

— deliberately never granting anything to `anon`, on the assumption that
a brand-new table starts with no privileges for anyone until explicitly
granted. Querying the real project's actual grants after the fact showed
otherwise:

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_name = 'patients';
-- anon: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
-- authenticated: same set
```

Root cause: Supabase pre-configures `ALTER DEFAULT PRIVILEGES` on the
`public` schema at project provisioning time, so that any table created
by the `postgres` role (the role migrations run as) automatically grants
full CRUD to both `anon` and `authenticated` the instant `CREATE TABLE`
runs — before a migration's own `GRANT` statements ever execute.
Confirmed by querying `pg_default_acl` directly:

```sql
select defaclrole::regrole::text, defaclnamespace::regnamespace::text,
       defaclobjtype
from pg_default_acl;
-- postgres / public / r  (tables), pre-existing, not something our
-- migrations set
```

**Why it didn't leak data:** table-level grants and RLS are two
independent gates. The RLS policy on `patients` is scoped `to
authenticated` only, so even with the table-level grant, `anon` matched
no policy and Postgres denied by default — an anonymous request was
still correctly blocked at the row level. One gate silently failed open;
the other happened to hold.

**Fix:** new migration
(`supabase/migrations/20260902094835_revoke_anon_default_privileges.sql`),
not an edit to the already-applied one:

```sql
revoke all on patients from anon;

alter default privileges for role postgres in schema public
  revoke all on tables from anon;
```

The second statement is the actual root-cause fix — it stops every
*future* table created by a migration from repeating this, not just
`patients`. Re-verified against the real project: `anon` now has zero
grants on `patients`, and the full test suite (including the RLS
isolation tests) still passes.

**Prevention:**

- Don't assume a new Supabase table starts with no privileges just
  because nothing granted any — check `information_schema.role_table_grants`
  (or `pg_default_acl` for the platform-level default) directly rather
  than inferring intended behavior from the migration file alone.
- Table-level grants and RLS policies are separate, independent gates;
  verify both explicitly rather than assuming one implies the other.

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
