import hashlib
import json
from dataclasses import asdict
from pathlib import Path

from labels import RiskCategory
from persistence import ModelPackage

# The imputable fields the serving-time feature vector actually reads. chol,
# vldl and genetics are imputed during training but never reach FEATURE_NAMES,
# so shipping their medians to the serving side would be dead weight a reader
# has to work out is unused.
SERVING_MEDIAN_FIELDS = (
    "age",
    "systolic",
    "diastolic",
    "bmi",
    "rbs",
    "trig",
    "hdl",
    "ldl",
    "hba1c",
)

_VERSION_PREFIX = "rf-"
_VERSION_DIGEST_LENGTH = 12

# Class order is the model's own output order (classes_ ascending), named in
# domain terms so the serving side never has to hardcode which column is which.
_CLASS_NAMES = tuple(category.name.lower() for category in sorted(RiskCategory))


def build_serving_model(package: ModelPackage) -> dict:
    """Flatten a trained ModelPackage into the JSON shape the Node app serves from.

    Emits the forest as parallel per-node arrays (the same layout scikit-learn
    holds internally) plus everything else a prediction needs: feature order,
    class order, and the training-time medians, so serving imputes with exactly
    the values training did.

    Args:
        package: The trained package loaded from disk.
    Returns:
        A JSON-serializable dict, carrying a content-derived version string.
    """
    expected = [category.value for category in sorted(RiskCategory)]
    if list(package.model.classes_) != expected:
        raise ValueError(f"model classes {list(package.model.classes_)} do not match {expected}")

    payload = {
        "featureNames": list(package.feature_names),
        "classes": list(_CLASS_NAMES),
        "medians": {field: getattr(package.medians, field) for field in SERVING_MEDIAN_FIELDS},
        "ratioMedians": asdict(package.ratio_medians),
        "trees": [_serialize_tree(estimator) for estimator in package.model.estimators_],
    }
    return {"version": _fingerprint(payload), **payload}


def save_serving_model(serving: dict, path: Path) -> None:
    """Write a serving model to disk as JSON, creating parent directories as needed.

    Args:
        serving: A dict built by build_serving_model.
        path: Destination file path.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(serving, f)


def _serialize_tree(estimator) -> dict:
    """Extract one fitted decision tree's node arrays.

    Args:
        estimator: A fitted DecisionTreeClassifier from the forest.
    Returns:
        Parallel arrays indexed by node id. A node whose left child is -1 is a
        leaf, and its `value` entry is that leaf's class distribution (already
        normalized to sum to 1 by scikit-learn, not raw sample counts).
    """
    tree = estimator.tree_
    return {
        "left": tree.children_left.tolist(),
        "right": tree.children_right.tolist(),
        "feature": tree.feature.tolist(),
        "threshold": tree.threshold.tolist(),
        "value": [node[0].tolist() for node in tree.value],
    }


def _fingerprint(payload: dict) -> str:
    """Derive a stable version string from a serving model's own content.

    Content-derived rather than a timestamp so the version changes when, and
    only when, something that affects a prediction changes - which is what a
    stored prediction needs in order to say what produced it.

    Args:
        payload: The serving model, without its version field.
    Returns:
        A short prefixed hash, e.g. "rf-a3f9c21b4e07".
    """
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(canonical.encode()).hexdigest()
    return _VERSION_PREFIX + digest[:_VERSION_DIGEST_LENGTH]
