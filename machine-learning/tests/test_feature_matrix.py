from assemble import CleanRow
from feature_matrix import FEATURE_NAMES, to_feature_vector
from features import EngineeredFeatures

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
    genetics=2,
)
_FEATURES = EngineeredFeatures(
    tg_hdl_ratio=3.0,
    ldl_hdl_ratio=2.0,
    hypertension_flag=False,
    age_bmi_interaction=1250.0,
)


def test_feature_vector_has_exactly_the_expected_keys_in_order():
    vector = to_feature_vector(_ROW, _FEATURES)
    assert list(vector.keys()) == list(FEATURE_NAMES)


def test_feature_vector_carries_the_correct_values():
    vector = to_feature_vector(_ROW, _FEATURES)
    assert vector == {
        "hba1c": 5.5,
        "age": 50.0,
        "sex_encoded": 1.0,
        "bmi": 25.0,
        "systolic": 120.0,
        "diastolic": 80.0,
        "rbs": 100.0,
        "tg_hdl_ratio": 3.0,
        "ldl_hdl_ratio": 2.0,
        "trig": 150.0,
        "hdl": 50.0,
        "hypertension_flag": 0.0,
        "age_bmi_interaction": 1250.0,
    }


def test_sex_encodes_female_as_zero():
    from dataclasses import replace

    vector = to_feature_vector(replace(_ROW, sex="female"), _FEATURES)
    assert vector["sex_encoded"] == 0.0


def test_hypertension_flag_encodes_true_as_one():
    from dataclasses import replace

    features = replace(_FEATURES, hypertension_flag=True)
    vector = to_feature_vector(_ROW, features)
    assert vector["hypertension_flag"] == 1.0
