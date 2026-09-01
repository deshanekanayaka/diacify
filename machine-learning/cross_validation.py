from collections.abc import Sequence
from dataclasses import dataclass
from statistics import mean, pstdev

from sklearn.base import ClassifierMixin
from sklearn.model_selection import StratifiedKFold, cross_val_score

from labels import RiskCategory
from model import to_label_array, to_training_matrix

# Matches legacy's k_fold_validation (train_model.py). Run on the training
# split only, not the full dataset - see context/current-feature.md for why:
# the alternative (matching legacy's full-dataset CV) reopens a smaller
# version of the leak already fixed at the train/test split.
_DEFAULT_N_SPLITS = 5
_DEFAULT_RANDOM_STATE = 42


@dataclass(frozen=True)
class CrossValidationResult:
    """Per-fold accuracy scores from stratified k-fold cross-validation."""

    fold_scores: list[float]
    mean: float
    std: float


def cross_validate_model(
    model: ClassifierMixin,
    x_train: Sequence[dict[str, float]],
    y_train: Sequence[RiskCategory],
    n_splits: int = _DEFAULT_N_SPLITS,
    random_state: int = _DEFAULT_RANDOM_STATE,
) -> CrossValidationResult:
    """Cross-validate a model's accuracy via stratified k-fold, on the training split.

    Args:
        model: An unfitted-or-fitted classifier - cross_val_score clones
            and refits it fresh for each fold, so only its hyperparameters
            matter, not any prior fit.
        x_train: Training feature vectors.
        y_train: Matching training labels.
        n_splits: Number of folds.
        random_state: Seed for reproducibility.
    Returns:
        The per-fold accuracy scores, their mean, and population std dev.
    """
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
    scores = cross_val_score(
        model,
        to_training_matrix(x_train),
        to_label_array(y_train),
        cv=skf,
        scoring="accuracy",
    ).tolist()

    return CrossValidationResult(fold_scores=scores, mean=mean(scores), std=pstdev(scores))
