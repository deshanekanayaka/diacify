from dataclasses import replace

from assemble import CleanRow
from features import RatioMedians, engineer_features, fit_ratio_medians

_ROW = CleanRow(
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
    hba1c=5.5,
    sex="male",
    social_life="city",
    genetics=1,
)

_MEDIANS = RatioMedians(tg_hdl_ratio=99.0, ldl_hdl_ratio=99.0)


def _row_with(**overrides) -> CleanRow:
    return replace(_ROW, **overrides)


def test_fit_ratio_medians_computes_the_median_ratio_across_rows():
    rows = [
        _row_with(trig=100.0, hdl=50.0, ldl=100.0),  # tg/hdl=2, ldl/hdl=2
        _row_with(trig=200.0, hdl=50.0, ldl=200.0),  # tg/hdl=4, ldl/hdl=4
        _row_with(trig=300.0, hdl=50.0, ldl=300.0),  # tg/hdl=6, ldl/hdl=6
    ]
    medians = fit_ratio_medians(rows)
    assert medians.tg_hdl_ratio == 4.0
    assert medians.ldl_hdl_ratio == 4.0


def test_fit_ratio_medians_excludes_rows_with_non_positive_hdl():
    rows = [
        _row_with(trig=100.0, hdl=50.0, ldl=100.0),  # tg/hdl=2, ldl/hdl=2
        _row_with(trig=999.0, hdl=0.0, ldl=999.0),  # excluded
    ]
    medians = fit_ratio_medians(rows)
    assert medians.tg_hdl_ratio == 2.0
    assert medians.ldl_hdl_ratio == 2.0


def test_engineer_features_computes_ratios_directly_when_hdl_is_positive():
    row = _row_with(trig=150.0, hdl=50.0, ldl=100.0)
    features = engineer_features(row, _MEDIANS)
    assert features.tg_hdl_ratio == 3.0
    assert features.ldl_hdl_ratio == 2.0


def test_engineer_features_falls_back_to_the_ratio_median_when_hdl_is_non_positive():
    row = _row_with(hdl=0.0)
    features = engineer_features(row, _MEDIANS)
    assert features.tg_hdl_ratio == 99.0
    assert features.ldl_hdl_ratio == 99.0


def test_engineer_features_flags_hypertension_at_the_systolic_threshold():
    high = engineer_features(_row_with(systolic=140.0, diastolic=80.0), _MEDIANS)
    low = engineer_features(_row_with(systolic=139.0, diastolic=80.0), _MEDIANS)
    assert high.hypertension_flag
    assert not low.hypertension_flag


def test_engineer_features_flags_hypertension_at_the_diastolic_threshold():
    high = engineer_features(_row_with(systolic=110.0, diastolic=90.0), _MEDIANS)
    low = engineer_features(_row_with(systolic=110.0, diastolic=89.0), _MEDIANS)
    assert high.hypertension_flag
    assert not low.hypertension_flag


def test_engineer_features_computes_the_age_bmi_interaction():
    row = _row_with(age=40.0, bmi=30.0)
    assert engineer_features(row, _MEDIANS).age_bmi_interaction == 1200.0
