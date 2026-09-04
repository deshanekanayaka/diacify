import json

from feature_matrix import FEATURE_NAMES
from features import RatioMedians
from imputation import Medians
from labels import RiskCategory
from model import fit_baseline_model
from persistence import ModelPackage
from serving_export import SERVING_MEDIAN_FIELDS, build_serving_model, save_serving_model


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


# All three classes are present deliberately: the exporter asserts the model's
# class order matches RiskCategory, which a two-class fixture cannot exercise.
_X_TRAIN = (
    [_vector(hba1c=h, age=a) for h in (4.5, 5.0) for a in (20, 30, 40, 50, 60)]
    + [_vector(hba1c=h, age=a) for h in (5.8, 6.0) for a in (20, 30, 40, 50, 60)]
    + [_vector(hba1c=h, age=a) for h in (7.0, 7.5) for a in (20, 30, 40, 50, 60)]
)
_Y_TRAIN = [RiskCategory.LOW] * 10 + [RiskCategory.MEDIUM] * 10 + [RiskCategory.HIGH] * 10

_MEDIANS = Medians(
    age=50.0, systolic=120.0, diastolic=80.0, bmi=25.0, rbs=100.0, chol=180.0,
    trig=150.0, hdl=50.0, ldl=100.0, vldl=30.0, hba1c=5.5, genetics=1.0,
)
_RATIO_MEDIANS = RatioMedians(tg_hdl_ratio=3.0, ldl_hdl_ratio=2.5)


def _package() -> ModelPackage:
    return ModelPackage(
        model=fit_baseline_model(_X_TRAIN, _Y_TRAIN),
        feature_names=FEATURE_NAMES,
        medians=_MEDIANS,
        ratio_medians=_RATIO_MEDIANS,
    )


def test_carries_feature_names_in_model_input_order():
    serving = build_serving_model(_package())
    assert serving["featureNames"] == list(FEATURE_NAMES)


def test_carries_class_names_in_model_output_order():
    serving = build_serving_model(_package())
    assert serving["classes"] == ["low", "medium", "high"]


def test_every_tree_carries_parallel_node_arrays():
    package = _package()
    serving = build_serving_model(package)

    assert len(serving["trees"]) == len(package.model.estimators_)
    for tree, estimator in zip(serving["trees"], package.model.estimators_, strict=True):
        node_count = estimator.tree_.node_count
        assert len(tree["left"]) == node_count
        assert len(tree["right"]) == node_count
        assert len(tree["feature"]) == node_count
        assert len(tree["threshold"]) == node_count
        assert len(tree["value"]) == node_count


def test_leaf_values_are_normalized_class_distributions():
    serving = build_serving_model(_package())
    for tree in serving["trees"]:
        for node, distribution in enumerate(tree["value"]):
            if tree["left"][node] == -1:
                assert len(distribution) == 3
                assert abs(sum(distribution) - 1.0) < 1e-9


def test_exports_only_the_medians_serving_actually_imputes():
    serving = build_serving_model(_package())
    assert set(serving["medians"]) == set(SERVING_MEDIAN_FIELDS)
    assert "chol" not in serving["medians"]
    assert serving["ratioMedians"] == {"tg_hdl_ratio": 3.0, "ldl_hdl_ratio": 2.5}


def test_version_is_stable_for_the_same_model():
    package = _package()
    assert build_serving_model(package)["version"] == build_serving_model(package)["version"]


def test_version_changes_when_the_model_changes():
    baseline = build_serving_model(_package())["version"]
    shifted = ModelPackage(
        model=fit_baseline_model(_X_TRAIN, _Y_TRAIN),
        feature_names=FEATURE_NAMES,
        medians=Medians(**{**_MEDIANS.__dict__, "hba1c": 6.0}),
        ratio_medians=_RATIO_MEDIANS,
    )
    assert build_serving_model(shifted)["version"] != baseline


def test_save_writes_loadable_json(tmp_path):
    path = tmp_path / "nested" / "model.json"
    serving = build_serving_model(_package())
    save_serving_model(serving, path)
    assert json.loads(path.read_text()) == serving
