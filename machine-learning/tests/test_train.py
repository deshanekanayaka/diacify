from assemble import CleanRow
from persistence import ModelPackage
from train import train_and_evaluate

_SMALL_GRID = [
    {
        "max_depth": [3, 5],
        "min_samples_split": [0.01],
        "max_features": [0.8],
        "max_samples": [0.8],
        "class_weight": ["balanced"],
    }
]


def _row(hba1c: float, age: float) -> CleanRow:
    return CleanRow(
        age=age,
        systolic=120.0,
        diastolic=80.0,
        bmi=25.0,
        rbs=100.0,
        chol=180.0,
        trig=150.0,
        hdl=50.0,
        ldl=100.0,
        vldl=30.0,
        hba1c=hba1c,
        sex="male" if age % 2 == 0 else "female",
        social_life="city",
        genetics=1,
    )


# 10 rows per class (low/medium/high), enough for an 80/20 split plus
# 5-fold CV on the training portion without an empty fold.
_ROWS = (
    [_row(hba1c=4.5 + i * 0.01, age=20 + i) for i in range(10)]
    + [_row(hba1c=6.0 + i * 0.01, age=20 + i) for i in range(10)]
    + [_row(hba1c=7.0 + i * 0.01, age=20 + i) for i in range(10)]
)


def test_train_and_evaluate_returns_a_model_package_and_metadata():
    package, metadata = train_and_evaluate(_ROWS, param_grid=_SMALL_GRID)

    assert isinstance(package, ModelPackage)
    assert hasattr(package.model, "feature_importances_")
    assert metadata["dataset_size"] == len(_ROWS)
    assert 0.0 <= metadata["test_accuracy"] <= 1.0
    assert "bias_audit" in metadata
    assert "feature_importances" in metadata
