from collections.abc import Sequence

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GridSearchCV

from labels import RiskCategory
from model import to_label_array, to_training_matrix

# Matches legacy's grid exactly (train_model.py::hyperparameter_tuning).
PARAM_GRID = [
    {
        "max_depth": [3, 5, 7, 10],
        "min_samples_split": [0.01, 0.03, 0.07, 0.1],
        "max_features": [0.7, 0.8, 0.9, 1.0],
        "max_samples": [0.7, 0.8, 0.9, 1.0],
        "class_weight": ["balanced"],
    }
]

_MODEL_RANDOM_STATE = 0
_DEFAULT_CV = 3


def search_hyperparameters(
    x_train: Sequence[dict[str, float]],
    y_train: Sequence[RiskCategory],
    param_grid=PARAM_GRID,
    cv: int = _DEFAULT_CV,
) -> GridSearchCV:
    """Grid-search RandomForestClassifier hyperparameters via cross-validation.

    Args:
        x_train: Training feature vectors.
        y_train: Matching training labels.
        param_grid: The hyperparameter grid to search - PARAM_GRID by
            default; tests pass a smaller grid for speed.
        cv: Number of cross-validation folds per parameter combination.
    Returns:
        The fitted GridSearchCV - its best_estimator_, best_params_,
        best_score_, and cv_results_ are what later steps (evaluation,
        cross-validation, feature importance, persistence) need.
    """
    model = RandomForestClassifier(random_state=_MODEL_RANDOM_STATE)
    search = GridSearchCV(estimator=model, param_grid=param_grid, cv=cv)
    search.fit(to_training_matrix(x_train), to_label_array(y_train))
    return search
