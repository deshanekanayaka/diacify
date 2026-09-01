from hyperparameter_search import PARAM_GRID, search_hyperparameters
from labels import RiskCategory


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

# A small grid for test speed - production code uses the full PARAM_GRID.
_SMALL_GRID = [
    {
        "max_depth": [3, 5],
        "min_samples_split": [0.01],
        "max_features": [0.8],
        "max_samples": [0.8],
        "class_weight": ["balanced"],
    }
]


def test_param_grid_matches_legacy():
    assert PARAM_GRID == [
        {
            "max_depth": [3, 5, 7, 10],
            "min_samples_split": [0.01, 0.03, 0.07, 0.1],
            "max_features": [0.7, 0.8, 0.9, 1.0],
            "max_samples": [0.7, 0.8, 0.9, 1.0],
            "class_weight": ["balanced"],
        }
    ]


def test_search_hyperparameters_returns_a_fitted_search():
    search = search_hyperparameters(_X_TRAIN, _Y_TRAIN, param_grid=_SMALL_GRID)
    assert hasattr(search.best_estimator_, "feature_importances_")


def test_search_hyperparameters_best_params_come_from_the_given_grid():
    search = search_hyperparameters(_X_TRAIN, _Y_TRAIN, param_grid=_SMALL_GRID)
    assert search.best_params_["max_depth"] in (3, 5)
    assert search.best_params_["class_weight"] == "balanced"
