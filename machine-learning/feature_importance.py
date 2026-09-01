from collections.abc import Sequence

from sklearn.base import ClassifierMixin

from feature_matrix import FEATURE_NAMES


def rank_feature_importance(
    model: ClassifierMixin, feature_names: Sequence[str] = FEATURE_NAMES
) -> list[tuple[str, float]]:
    """Pair each feature name with the fitted model's importance score, ranked descending.

    Args:
        model: A fitted model exposing feature_importances_ (e.g.
            RandomForestClassifier), in the same order as feature_names.
        feature_names: The feature names, in the order the model was
            trained on - FEATURE_NAMES by default.
    Returns:
        (name, importance) pairs, most important first.
    """
    paired = list(zip(feature_names, model.feature_importances_, strict=True))
    return sorted(paired, key=lambda pair: pair[1], reverse=True)
