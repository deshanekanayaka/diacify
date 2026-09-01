import json
import pickle
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from sklearn.base import ClassifierMixin

from cross_validation import CrossValidationResult
from features import RatioMedians
from imputation import Medians
from labels import CLINICAL_THRESHOLDS
from model import EvaluationResult

_CLASS_NAMES = ["Low", "Medium", "High"]
_METRIC_KEYS = ["precision", "recall", "f1-score", "support"]


@dataclass(frozen=True)
class ModelPackage:
    """Everything needed to reproduce this model's predictions elsewhere (e.g. serving).

    feature_names travels with the model so a caller always uses the
    correct feature set and order without hardcoding it separately.
    medians/ratio_medians let a caller impute a new patient's missing
    fields with the exact values used at training time (train/serve
    parity - see BUGS.md for why this matters).
    """

    model: ClassifierMixin
    feature_names: tuple[str, ...]
    medians: Medians
    ratio_medians: RatioMedians


def save_model_package(package: ModelPackage, path: Path) -> None:
    """Pickle a ModelPackage to disk, creating parent directories as needed.

    Args:
        package: The package to save.
        path: Destination file path.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(package, f)


def load_model_package(path: Path) -> ModelPackage:
    """Load a previously saved ModelPackage.

    Args:
        path: Source file path.
    Returns:
        The unpickled ModelPackage.
    """
    with open(path, "rb") as f:
        return pickle.load(f)


def build_metadata(
    dataset_size: int,
    test_set_size: int,
    cv_result: CrossValidationResult,
    evaluation: EvaluationResult,
    feature_importance: Sequence[tuple[str, float]],
    bias_audit_results: dict[str, dict],
) -> dict:
    """Assemble a JSON-serializable record of one training run, for audit and transparency.

    Args:
        dataset_size: Total rows in the source dataset.
        test_set_size: Rows held out for evaluation.
        cv_result: Cross-validation results on the training split.
        evaluation: Single train/test evaluation results.
        feature_importance: Ranked (name, importance) pairs.
        bias_audit_results: Per-subgroup classification reports.
    Returns:
        A dict ready for json.dump - training date, dataset composition,
        exclusion rationale, CV/test metrics, feature importances, bias
        audit, and the exact clinical thresholds that produced the labels.
    """
    report = evaluation.classification_report
    return {
        "training_date": datetime.now().isoformat(),
        "dataset_size": dataset_size,
        "test_set_size": test_set_size,
        "labelling_method": "ADA 2025 HbA1c thresholds + five-flag composite upgrade rule",
        "fbs_excluded": True,
        "fbs_exclusion_reason": "96.5% missing (639 of 662 records) - statistically unreliable",
        "genetics_excluded": True,
        "genetics_exclusion_reason": (
            "feature importance 0.0003, ~3 orders of magnitude below the top "
            "feature - negligible predictive value"
        ),
        "cv_mean_accuracy": round(cv_result.mean, 4),
        "cv_std": round(cv_result.std, 4),
        "cv_fold_scores": [round(score, 4) for score in cv_result.fold_scores],
        "test_accuracy": round(evaluation.accuracy, 4),
        "per_class_metrics": {
            cls: {key: round(report[cls][key], 4) for key in _METRIC_KEYS}
            for cls in _CLASS_NAMES
        },
        "feature_importances": {name: round(score, 4) for name, score in feature_importance},
        "bias_audit": bias_audit_results,
        "clinical_thresholds": CLINICAL_THRESHOLDS,
    }


def save_metadata(metadata: dict, path: Path) -> None:
    """Write a metadata dict to disk as human-readable JSON.

    Args:
        metadata: A dict built by build_metadata.
        path: Destination file path.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(metadata, f, indent=2)
