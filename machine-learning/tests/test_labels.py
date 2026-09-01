from dataclasses import replace

from assemble import CleanRow
from features import EngineeredFeatures
from labels import RiskCategory, assign_label

# A row/features pair with every secondary flag safely below threshold, so
# only Stage A (the HbA1c base label) is in play unless a test overrides it.
_ROW = CleanRow(
    age=50.0,
    systolic=110.0,
    diastolic=70.0,
    bmi=22.0,
    rbs=90.0,
    chol=180.0,
    trig=100.0,
    hdl=50.0,
    ldl=100.0,
    vldl=30.0,
    hba1c=5.0,
    sex="male",
    social_life="city",
    genetics=1,
)
_FEATURES = EngineeredFeatures(
    tg_hdl_ratio=1.0,
    ldl_hdl_ratio=1.0,
    hypertension_flag=False,
    age_bmi_interaction=1100.0,
)


def _row_with(**overrides) -> CleanRow:
    return replace(_ROW, **overrides)


def _features_with(**overrides) -> EngineeredFeatures:
    return replace(_FEATURES, **overrides)


def test_base_label_is_low_below_the_prediabetes_threshold():
    assert assign_label(_row_with(hba1c=5.6), _FEATURES) == RiskCategory.LOW


def test_base_label_is_medium_at_the_prediabetes_threshold():
    assert assign_label(_row_with(hba1c=5.7), _FEATURES) == RiskCategory.MEDIUM


def test_base_label_is_high_at_the_diabetes_threshold():
    assert assign_label(_row_with(hba1c=6.5), _FEATURES) == RiskCategory.HIGH


def test_single_secondary_flag_does_not_upgrade_the_label():
    row = _row_with(hba1c=5.0, bmi=35.0)  # only obesity raised
    assert assign_label(row, _FEATURES) == RiskCategory.LOW


def test_two_secondary_flags_upgrade_the_label_by_one_tier():
    row = _row_with(hba1c=5.0, bmi=35.0, rbs=130.0)  # obesity + high RBS
    assert assign_label(row, _FEATURES) == RiskCategory.MEDIUM


def test_upgrade_is_capped_at_high_rather_than_overflowing():
    row = _row_with(hba1c=6.5, bmi=35.0, rbs=130.0)  # already High + 2 flags
    assert assign_label(row, _FEATURES) == RiskCategory.HIGH


def test_hypertension_flag_counts_toward_the_upgrade():
    row = _row_with(hba1c=5.0, bmi=35.0)
    features = _features_with(hypertension_flag=True)
    assert assign_label(row, features) == RiskCategory.MEDIUM


def test_tg_hdl_ratio_flag_counts_toward_the_upgrade():
    row = _row_with(hba1c=5.0, bmi=35.0)
    features = _features_with(tg_hdl_ratio=3.0)
    assert assign_label(row, features) == RiskCategory.MEDIUM


def test_ldl_hdl_ratio_flag_counts_toward_the_upgrade():
    row = _row_with(hba1c=5.0, bmi=35.0)
    features = _features_with(ldl_hdl_ratio=4.0)
    assert assign_label(row, features) == RiskCategory.MEDIUM
