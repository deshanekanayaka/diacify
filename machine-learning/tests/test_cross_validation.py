from cross_validation import CrossValidationResult, cross_validate_model
from labels import RiskCategory
from model import fit_baseline_model


def _vector(hba1c: float, age: float) -> dict[str, float]:
    return {
        "hba1c": hba1c,
        "age": age,
        "sex_encoded": 1.0,
        "bmi": 25.0,
        "systolic": 120.0,
        "diastolic": 80.0,
        "rbs": 100.0,
        "tg_hdl_ratio": 2.0,
        "ldl_hdl_ratio": 2.0,
        "trig": 150.0,
        "hdl": 50.0,
        "genetics": 1.0,
        "hypertension_flag": 0.0,
        "age_bmi_interaction": age * 25.0,
    }


_X_TRAIN = (
    [_vector(hba1c=h, age=a) for h in (4.5, 5.0) for a in (20, 30, 40, 50, 60)]
    + [_vector(hba1c=h, age=a) for h in (6.0, 6.2) for a in (20, 30, 40, 50, 60)]
    + [_vector(hba1c=h, age=a) for h in (7.0, 7.5) for a in (20, 30, 40, 50, 60)]
)
_Y_TRAIN = (
    [RiskCategory.LOW] * 10 + [RiskCategory.MEDIUM] * 10 + [RiskCategory.HIGH] * 10
)


def test_cross_validate_model_returns_one_score_per_fold():
    model = fit_baseline_model(_X_TRAIN, _Y_TRAIN)
    result = cross_validate_model(model, _X_TRAIN, _Y_TRAIN, n_splits=5)
    assert isinstance(result, CrossValidationResult)
    assert len(result.fold_scores) == 5
    assert all(0.0 <= s <= 1.0 for s in result.fold_scores)


def test_cross_validate_model_mean_and_std_match_the_fold_scores():
    model = fit_baseline_model(_X_TRAIN, _Y_TRAIN)
    result = cross_validate_model(model, _X_TRAIN, _Y_TRAIN, n_splits=5)
    from statistics import mean, pstdev

    assert result.mean == mean(result.fold_scores)
    assert result.std == pstdev(result.fold_scores)


def test_cross_validate_model_is_reproducible():
    model = fit_baseline_model(_X_TRAIN, _Y_TRAIN)
    result1 = cross_validate_model(model, _X_TRAIN, _Y_TRAIN, n_splits=5, random_state=42)
    result2 = cross_validate_model(model, _X_TRAIN, _Y_TRAIN, n_splits=5, random_state=42)
    assert result1.fold_scores == result2.fold_scores
