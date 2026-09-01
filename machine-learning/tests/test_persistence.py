import json

from cross_validation import CrossValidationResult
from features import RatioMedians
from imputation import Medians
from labels import RiskCategory
from model import EvaluationResult, fit_baseline_model
from persistence import ModelPackage, build_metadata, load_model_package, save_model_package


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
        "hypertension_flag": 0.0,
        "age_bmi_interaction": age * 25.0,
    }


_X_TRAIN = [_vector(hba1c=h, age=a) for h in (4.5, 5.0) for a in (20, 30, 40, 50, 60)] + [
    _vector(hba1c=h, age=a) for h in (7.0, 7.5) for a in (20, 30, 40, 50, 60)
]
_Y_TRAIN = [RiskCategory.LOW] * 10 + [RiskCategory.HIGH] * 10

_MEDIANS = Medians(
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
    genetics=1.0,
)
_RATIO_MEDIANS = RatioMedians(tg_hdl_ratio=3.0, ldl_hdl_ratio=2.5)


def test_save_and_load_model_package_round_trips(tmp_path):
    from feature_matrix import FEATURE_NAMES
    from model import to_training_matrix

    model = fit_baseline_model(_X_TRAIN, _Y_TRAIN)
    package = ModelPackage(
        model=model,
        feature_names=FEATURE_NAMES,
        medians=_MEDIANS,
        ratio_medians=_RATIO_MEDIANS,
    )
    path = tmp_path / "model.pkl"

    save_model_package(package, path)
    loaded = load_model_package(path)

    assert loaded.feature_names == package.feature_names
    assert loaded.medians == package.medians
    assert loaded.ratio_medians == package.ratio_medians

    sample = to_training_matrix([_X_TRAIN[0]])
    assert loaded.model.predict(sample).tolist() == model.predict(sample).tolist()


def test_build_metadata_is_json_serializable():
    evaluation = EvaluationResult(
        accuracy=0.95,
        confusion_matrix=[[10, 0, 0], [0, 9, 1], [0, 1, 9]],
        classification_report={
            "Low": {"precision": 1.0, "recall": 1.0, "f1-score": 1.0, "support": 10},
            "Medium": {"precision": 0.9, "recall": 0.9, "f1-score": 0.9, "support": 10},
            "High": {"precision": 0.9, "recall": 0.9, "f1-score": 0.9, "support": 10},
            "accuracy": 0.95,
        },
    )
    cv_result = CrossValidationResult(fold_scores=[0.9, 0.95, 0.92], mean=0.923, std=0.02)

    metadata = build_metadata(
        dataset_size=662,
        test_set_size=133,
        cv_result=cv_result,
        evaluation=evaluation,
        feature_importance=[("hba1c", 0.41), ("age", 0.01)],
        bias_audit_results={"sex_male": {"Low": {"precision": 1.0}}},
    )

    json.dumps(metadata)  # raises if anything isn't serializable
    assert metadata["dataset_size"] == 662
    assert metadata["test_set_size"] == 133
    assert metadata["cv_mean_accuracy"] == 0.923
    assert metadata["test_accuracy"] == 0.95
    assert metadata["feature_importances"] == {"hba1c": 0.41, "age": 0.01}
    assert metadata["clinical_thresholds"]["hba1c_diabetes"] == 6.5
