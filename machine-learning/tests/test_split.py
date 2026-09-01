from dataclasses import replace
from statistics import median

from assemble import CleanRow
from split import prepare_train_test_data, split_rows

_BASE_ROW = CleanRow(
    age=50.0,
    systolic=120.0,
    diastolic=80.0,
    bmi=25.0,
    rbs=100.0,
    chol=180.0,
    trig=150.0,
    hdl=50.0,
    ldl=100.0,
    vldl=30.0,
    hba1c=5.0,
    sex="male",
    social_life="city",
    genetics=1,
)


def _rows(n: int, **overrides) -> list[CleanRow]:
    return [replace(_BASE_ROW, **overrides) for _ in range(n)]


def _mixed_rows(n_per_class: int) -> list[CleanRow]:
    # hba1c values chosen to land in each RiskCategory tier (see
    # labels.base_label_from_hba1c): <5.7 low, 5.7-6.4 medium, >=6.5 high.
    return (
        [replace(_BASE_ROW, age=float(i), hba1c=5.0) for i in range(n_per_class)]
        + [replace(_BASE_ROW, age=float(i), hba1c=6.0) for i in range(n_per_class)]
        + [replace(_BASE_ROW, age=float(i), hba1c=7.0) for i in range(n_per_class)]
    )


def test_split_rows_uses_an_80_20_split():
    rows = _mixed_rows(50)  # 150 rows
    train, test = split_rows(rows)
    assert len(train) == 120
    assert len(test) == 30


def test_split_rows_accounts_for_every_row():
    rows = _mixed_rows(50)
    train, test = split_rows(rows)
    assert len(train) + len(test) == len(rows)


def test_split_rows_is_reproducible():
    rows = _mixed_rows(50)
    train1, test1 = split_rows(rows)
    train2, test2 = split_rows(rows)
    assert train1 == train2
    assert test1 == test2


def test_split_rows_preserves_class_proportions():
    rows = _mixed_rows(50)  # 50/50/50 across low/medium/high
    train, test = split_rows(rows)
    train_highs = sum(1 for r in train if r.hba1c == 7.0)
    test_highs = sum(1 for r in test if r.hba1c == 7.0)
    # Stratified: each split should keep roughly a third high, not be
    # skewed toward all-high-in-test or none-in-test.
    assert train_highs == 40
    assert test_highs == 10


def test_prepare_train_test_data_fits_medians_on_the_training_split_only():
    rows = _mixed_rows(50)
    # Give a handful of rows a missing bmi, all landing in a range that
    # could plausibly fall on either side of the split.
    rows = [replace(r, bmi=None) if i % 10 == 0 else r for i, r in enumerate(rows)]
    for i in range(0, len(rows), 3):
        rows[i] = replace(rows[i], bmi=20.0 + i % 15)

    data = prepare_train_test_data(rows)

    train_rows, _ = split_rows(rows)
    expected_bmi_median = median(r.bmi for r in train_rows if r.bmi is not None)
    assert data.medians.bmi == expected_bmi_median


def test_prepare_train_test_data_produces_matching_length_vectors_and_labels():
    rows = _mixed_rows(50)
    data = prepare_train_test_data(rows)
    assert len(data.x_train) == len(data.y_train) == 120
    assert len(data.x_test) == len(data.y_test) == 30
