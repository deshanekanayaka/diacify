from collections.abc import Sequence
from dataclasses import dataclass

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix

from feature_matrix import FEATURE_NAMES
from labels import RiskCategory

# Legacy's baseline hyperparameters (train_model.py::fit_and_evaluate_model),
# before hyperparameter search finds better ones.
_MAX_DEPTH = 5
_MIN_SAMPLES_SPLIT = 0.01
_MAX_FEATURES = 0.8
_MAX_SAMPLES = 0.8
_MODEL_RANDOM_STATE = 0

_CLASS_NAMES = ["Low", "Medium", "High"]


@dataclass(frozen=True)
class EvaluationResult:
    """A model's performance on a held-out set."""

    accuracy: float
    confusion_matrix: list[list[int]]
    classification_report: dict


def to_training_matrix(vectors: Sequence[dict[str, float]]) -> pd.DataFrame:
    """Convert feature vectors into the DataFrame shape sklearn expects.

    Args:
        vectors: Feature vectors, e.g. TrainTestData.x_train/x_test.
    Returns:
        A DataFrame with columns forced to FEATURE_NAMES order, regardless
        of each dict's own key order.
    """
    return pd.DataFrame(list(vectors), columns=list(FEATURE_NAMES))


def to_label_array(labels: Sequence[RiskCategory]) -> list[int]:
    """Convert RiskCategory labels into plain ints for sklearn.

    Args:
        labels: RiskCategory labels, e.g. TrainTestData.y_train/y_test.
    Returns:
        The same labels as plain ints (RiskCategory is an IntEnum).
    """
    return [int(label) for label in labels]


def fit_baseline_model(
    x_train: Sequence[dict[str, float]], y_train: Sequence[RiskCategory]
) -> RandomForestClassifier:
    """Fit a RandomForestClassifier using legacy's baseline hyperparameters.

    class_weight="balanced" is kept as a safeguard even though the real
    label distribution is close to balanced, so it does little work today -
    see labels.py's distribution note in context/current-feature.md.

    Args:
        x_train: Training feature vectors.
        y_train: Matching training labels.
    Returns:
        The fitted model.
    """
    model = RandomForestClassifier(
        random_state=_MODEL_RANDOM_STATE,
        max_depth=_MAX_DEPTH,
        min_samples_split=_MIN_SAMPLES_SPLIT,
        max_features=_MAX_FEATURES,
        max_samples=_MAX_SAMPLES,
        class_weight="balanced",
    )
    model.fit(to_training_matrix(x_train), to_label_array(y_train))
    return model


def evaluate_model(
    model: RandomForestClassifier,
    x_test: Sequence[dict[str, float]],
    y_test: Sequence[RiskCategory],
) -> EvaluationResult:
    """Evaluate a fitted model against a held-out set.

    Args:
        model: A fitted classifier.
        x_test: Held-out feature vectors.
        y_test: Matching held-out labels.
    Returns:
        The accuracy, confusion matrix, and per-class precision/recall/F1.
    """
    y_true = to_label_array(y_test)
    y_pred = model.predict(to_training_matrix(x_test))

    report = classification_report(
        y_true, y_pred, target_names=_CLASS_NAMES, output_dict=True, zero_division=0
    )
    accuracy = report["accuracy"]

    return EvaluationResult(
        accuracy=accuracy,
        confusion_matrix=confusion_matrix(y_true, y_pred).tolist(),
        classification_report=report,
    )
