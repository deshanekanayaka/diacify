from bias_audit import audit_bias
from labels import RiskCategory
from model import fit_baseline_model


def _vector(hba1c: float, age: float, sex_encoded: float) -> dict[str, float]:
    return {
        "hba1c": hba1c,
        "age": age,
        "sex_encoded": sex_encoded,
        "bmi": 25.0,
        "systolic": 120.0,
        "diastolic": 80.0,
        "rbs": 100.0,
        "tg_hdl_ratio": 2.0,
        "ldl_hdl_ratio": 2.0,
        "trig": 150.0,
        "hdl": 50.0,
        "hypertension_flag": 0.0,
        "age_bmi_interaction": age * 25.0,
    }


# Ages and sexes span all three age buckets and both sexes so every group
# in the audit has at least one member.
_X = [
    _vector(hba1c=4.5, age=25, sex_encoded=1.0),
    _vector(hba1c=5.0, age=45, sex_encoded=0.0),
    _vector(hba1c=6.0, age=65, sex_encoded=1.0),
    _vector(hba1c=6.2, age=30, sex_encoded=0.0),
    _vector(hba1c=7.0, age=50, sex_encoded=1.0),
    _vector(hba1c=7.5, age=70, sex_encoded=0.0),
]
_Y = [
    RiskCategory.LOW,
    RiskCategory.LOW,
    RiskCategory.MEDIUM,
    RiskCategory.MEDIUM,
    RiskCategory.HIGH,
    RiskCategory.HIGH,
]


def test_audit_bias_covers_both_sexes_and_all_age_buckets():
    model = fit_baseline_model(_X, _Y)
    results = audit_bias(model, _X, _Y)
    assert set(results.keys()) == {
        "sex_male",
        "sex_female",
        "age_under_40",
        "age_40_60",
        "age_over_60",
    }


def test_audit_bias_reports_have_a_row_per_class():
    model = fit_baseline_model(_X, _Y)
    results = audit_bias(model, _X, _Y)
    for report in results.values():
        assert set(report.keys()) >= {"Low", "Medium", "High"}


def test_audit_bias_skips_a_group_with_no_members():
    model = fit_baseline_model(_X, _Y)
    male_only = [v for v in _X if v["sex_encoded"] == 1.0]
    male_only_y = [_Y[i] for i, v in enumerate(_X) if v["sex_encoded"] == 1.0]
    results = audit_bias(model, male_only, male_only_y)
    assert "sex_female" not in results
    assert "sex_male" in results
