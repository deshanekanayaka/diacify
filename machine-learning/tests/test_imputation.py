from assemble import CleanRow
from imputation import Medians, fit, transform

_COMPLETE_ROW = CleanRow(
    age=51.0,
    systolic=130.0,
    diastolic=90.0,
    bmi=27.4,
    rbs=140.0,
    chol=180.0,
    trig=150.0,
    hdl=45.0,
    ldl=100.0,
    vldl=30.0,
    hba1c=6.1,
    sex="male",
    social_life="city",
    genetics=2,
)


def _row_with(**overrides) -> CleanRow:
    from dataclasses import replace

    return replace(_COMPLETE_ROW, **overrides)


def test_fit_computes_the_median_of_present_values_per_field():
    rows = [_row_with(age=40.0), _row_with(age=50.0), _row_with(age=60.0)]
    medians = fit(rows)
    assert medians.age == 50.0


def test_fit_ignores_none_when_computing_the_median():
    rows = [_row_with(age=40.0), _row_with(age=None), _row_with(age=60.0)]
    medians = fit(rows)
    assert medians.age == 50.0


def test_transform_fills_missing_fields_from_medians():
    medians = fit([_row_with(bmi=20.0), _row_with(bmi=30.0)])
    row = _row_with(bmi=None)
    assert transform(row, medians).bmi == 25.0


def test_transform_leaves_present_values_untouched():
    medians = Medians(
        age=99.0,
        systolic=99.0,
        diastolic=99.0,
        bmi=99.0,
        rbs=99.0,
        chol=99.0,
        trig=99.0,
        hdl=99.0,
        ldl=99.0,
        vldl=99.0,
        hba1c=99.0,
        genetics=99,
    )
    row = _row_with(age=51.0)
    assert transform(row, medians).age == 51.0


def test_transform_rounds_the_imputed_genetics_count_to_the_nearest_int():
    medians = fit([_row_with(genetics=1), _row_with(genetics=2)])
    row = _row_with(genetics=None)
    imputed = transform(row, medians).genetics
    assert imputed == 2
    assert isinstance(imputed, int)


def test_transform_does_not_impute_categorical_fields():
    medians = fit([_row_with()])
    row = _row_with(sex=None, social_life=None)
    result = transform(row, medians)
    assert result.sex is None
    assert result.social_life is None
