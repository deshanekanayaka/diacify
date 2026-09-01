from labels import RiskCategory
from model import (
    EvaluationResult,
    evaluate_model,
    fit_baseline_model,
    to_label_array,
    to_training_matrix,
)


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


# Separable-enough synthetic data so the baseline model can actually learn
# something, covering all three classes with several samples each.
_X_TRAIN = [_vector(hba1c=h, age=a) for h in (4.5, 5.0) for a in (20, 30, 40, 50, 60)] + [
    _vector(hba1c=h, age=a) for h in (6.0, 6.2) for a in (20, 30, 40, 50, 60)
] + [_vector(hba1c=h, age=a) for h in (7.0, 7.5) for a in (20, 30, 40, 50, 60)]
_Y_TRAIN = (
    [RiskCategory.LOW] * 10 + [RiskCategory.MEDIUM] * 10 + [RiskCategory.HIGH] * 10
)


def test_to_training_matrix_has_columns_in_feature_names_order():
    from feature_matrix import FEATURE_NAMES

    matrix = to_training_matrix(_X_TRAIN)
    assert list(matrix.columns) == list(FEATURE_NAMES)
    assert len(matrix) == len(_X_TRAIN)


def test_to_label_array_converts_risk_category_to_plain_ints():
    labels = to_label_array([RiskCategory.LOW, RiskCategory.MEDIUM, RiskCategory.HIGH])
    assert labels == [0, 1, 2]


def test_fit_baseline_model_returns_a_fitted_classifier():
    model = fit_baseline_model(_X_TRAIN, _Y_TRAIN)
    assert hasattr(model, "feature_importances_")
    predictions = model.predict(to_training_matrix(_X_TRAIN))
    assert len(predictions) == len(_X_TRAIN)


def test_evaluate_model_returns_accuracy_and_confusion_matrix():
    model = fit_baseline_model(_X_TRAIN, _Y_TRAIN)
    result = evaluate_model(model, _X_TRAIN, _Y_TRAIN)

    assert isinstance(result, EvaluationResult)
    assert 0.0 <= result.accuracy <= 1.0
    assert len(result.confusion_matrix) == 3
    assert all(len(row) == 3 for row in result.confusion_matrix)
    assert set(result.classification_report.keys()) >= {"Low", "Medium", "High"}
