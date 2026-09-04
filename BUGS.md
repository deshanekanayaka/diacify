# Bugs

Log of real bugs found during development — root cause, fix, and how we
prevent the same class of bug going forward. Newest first.

---

## `risk_assessments` was documented as append-only but granted `update` and `delete`

**Found:** 2026-09-04, via a CodeRabbit review comment on PR #41
(`feature/persist-risk-assessments`).

**What happened:**

The migration creating `risk_assessments` describes the table as
append-only, in its own comment, in ADR-028, and in the commit message.
It then wrote:

```sql
create policy "clinicians manage risk assessments for their own patients"
  on risk_assessments
  for all
  to authenticated
  ...

grant select, insert, update, delete on risk_assessments to authenticated;
```

`for all` plus a full grant means a clinician could `UPDATE` a stored
assessment's `risk_category`, or `DELETE` it outright. RLS held on the
dimension it was tested for — clinician B genuinely could not touch
clinician A's rows — so the cross-tenant tests all passed. What nothing
tested, or prevented, was the *owner* rewriting their own.

That matters more here than table-level tidiness. The entire argument for
storing assessments per model version is that a row records what a
particular model concluded. If the row is editable, it records what
someone last decided it should say, and ADR-028's claim that "retraining
adds rows instead of erasing them" is undercut by a `delete` grant that
erases them on request.

The route made the same mistake in code. `.upsert(..., { onConflict })` is
`ON CONFLICT DO UPDATE` — so the retry path rewrote the existing row on
every repeat call. It wrote identical values, because scoring is
deterministic, so nothing observable went wrong; but the mechanism was an
update, which is what append-only forbids. The `created_at` test appeared
to cover this and did not: it proved the timestamp survived, not that the
row was left alone.

**Root cause:** the append-only property was expressed as prose in
comments rather than as a privilege. Nothing in the schema disagreed with
the sentence, so nothing caught it.

**Fix:** a second, forward-only migration
(`20260904231426_risk_assessments_append_only.sql`) replaces the `for all`
policy with separate `for select` and `for insert` policies and revokes
`update, delete` from `authenticated` — both gates closed, the same
defence-in-depth ADR-012 established. The route now does a plain `insert`
and treats a `23505` unique violation as success: a collision means the
visit was already scored by this model, and since the row can no longer
be edited, it necessarily holds the values we just computed, so no read
is needed to return them.

**Verification:** the two cross-tenant tests changed shape and that is the
tell — with the privilege revoked, another clinician's `UPDATE`/`DELETE`
is refused outright rather than silently filtered to zero rows. New tests
cover the owning clinician being refused both. Confirmed against a running
server: `PATCH` and `DELETE` on an assessment by its own owner both return
`403`, while three `predict` calls still return `200` and leave one row.

Also verified rather than assumed: deleting a patient still cascades to
its assessments without the `delete` privilege, because a foreign-key
cascade runs as a referential-integrity action and does not consult the
caller's grants. That assumption was load-bearing for the fix, so it has
its own test.

**Prevention:** when a property is stated in a comment, ask what enforces
it. "Append-only" is a privilege, not a description — the same lesson as
the `anon` grant bug below, where a table documented as closed to `anon`
was open because nothing had actually revoked it.

---

## Pagination had no deterministic tiebreaker, risking repeated or skipped rows across pages

**Found:** 2026-09-02, via a CodeRabbit review comment on PR for
`feature/get-patients-endpoint` (`GET /api/patients`).

**What happened:**

The patients query sorted only by `created_at`:

```ts
const { data, error, count } = await client
  .from("patients")
  .select("*", { count: "exact" })
  .order("created_at", { ascending: false })
  .range(from, to);
```

Postgres does not guarantee a stable row order across *separate*
queries when the sort column has ties — two rows with the same
`created_at` can come back in a different relative order on different
requests. Since each page of results is its own separate query
(`range(0, 19)`, then `range(20, 39)`, ...), a tie straddling a page
boundary could mean the same patient shows up on two pages, or a
different patient never shows up on any page.

**Fix:**

```ts
.order("created_at", { ascending: false })
.order("id", { ascending: false })
```

`id` is a UUID primary key — always unique, so once it's added as a
secondary sort key there are never any remaining ties, and row order is
fully deterministic across every page, every time.

**Verification note, stated honestly:** the regression test added
(`patients.test.ts`, "walks every page with limit=1...") walks all
pages and checks every patient appears exactly once — but it doesn't
force an actual tie, since two sequential HTTP inserts essentially
never land on the exact same `created_at` in practice. It verifies
general pagination completeness, not a reproduction of the specific
tie-break bug. The fix is applied on the general correctness principle
(ties are possible in principle, however rare here), not because the
test proves the bug would otherwise occur.

**Prevention:**

- Any paginated query needs a sort key that's unique per row, not just
  "good enough in practice." A primary key as a secondary sort column
  is the cheap, general fix.

---

## Pagination accepted numbers beyond `Number.MAX_SAFE_INTEGER`, producing nonsensical range values

**Found:** 2026-09-02, via a CodeRabbit review comment on PR for
`feature/get-patients-endpoint` (`GET /api/patients`).

**What happened:**

`parsePositiveInt` validated a query param with a regex and a
lower-bound check, but nothing checked the *upper* bound of what
`Number()` can safely represent:

```ts
function parsePositiveInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return parsed >= 1 ? parsed : null;   // no upper bound check
}
```

`?page=99999999999999999999` (20 nines) passes `/^\d+$/` (all digits)
and `Number(...)  >= 1`, so it was accepted as "valid." Confirmed
directly:

```
Number("99999999999999999999999999")  →  1e+22
Number.isSafeInteger(1e+22)            →  false
```

That value then fed directly into `from = (page - 1) * limit`,
producing `from`/`to` as `1e+22` — sent to Supabase's `.range()` call.
Tested against the real client: it happened to return `200` with an
empty result rather than crashing, but that's incidental behavior of
Supabase's HTTP layer serializing a garbage range header, not a
guarantee — and even the "safe" outcome is a `200` for a request that
should have been rejected as invalid.

**Fix:**

```ts
return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
```

An out-of-safe-range `page` or `limit` is now rejected with a clean
`400`, at the same single validation boundary that already handles
non-numeric and negative input — not a second check bolted onto the
route.

**Prevention:**

- When validating a numeric string from user input, check both bounds
  (`Number.isSafeInteger`, not just `>= 1`) — a regex confirming
  "digits only" says nothing about whether the resulting number is
  small enough to do arithmetic on safely.

---

## Test runs left orphaned clinician accounts and patient rows on the local Supabase stack

**Found:** 2026-09-02, via a CodeRabbit review comment on PR for
`feature/get-patients-endpoint`, confirmed by directly counting rows
before any fix.

**What happened:**

Both `patients.rls.test.ts` and `patients.test.ts` sign up real
clinician accounts against the local Supabase stack (`supabase start`)
to prove RLS/the route work end-to-end. Every run created new accounts
via `auth.signUp`, but nothing ever deleted them afterward. Confirmed
the accumulation directly rather than assuming it was a problem:

```sql
select count(*) from auth.users;   -- 9
select count(*) from patients;     -- 8
```

— both already non-zero from ordinary repeated test runs earlier in
this same session, with no `supabase db reset` in between.

**Fix:**

`backend/src/db/testCleanup.ts::deleteTestUser` — deletes a user via
the local stack's admin API in an `afterAll` hook in both test files.
`clinician_id`'s `on delete cascade` means deleting the user also
removes every patient row they owned, so no separate patient cleanup
is needed.

**Verification:** ran the full suite twice in a row and confirmed
`auth.users`'s count stayed flat rather than growing by 4 (2 test
files × 2 clinicians each) on the second run.

**Prevention:**

- Any test that creates real accounts/rows against a real (even local)
  backing store needs matching `afterAll` cleanup — don't rely on
  periodic manual `supabase db reset` to keep the local stack usable.
- `SUPABASE_SECRET_KEY` (the local stack's admin key, needed for
  `auth.admin.deleteUser`) lives only in `.env.test`, gitignored, and
  is only ever read by `testCleanup.ts` — never wired anywhere that
  could reach the real project.

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
