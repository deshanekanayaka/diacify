"""Generate the fixture that holds the Node forest traversal to scikit-learn's output.

Two sets, for two different reasons:

`real` is every row of the training dataset, put through the same serving-shaped
path a request takes (impute, engineer, vectorize).

`nearThreshold` exists because `real` alone is not enough. scikit-learn casts
features to float32 before comparing them to a split threshold; a naive float64
comparison in another language sends a value that sits between a threshold and
the next float32 above it down the *other* branch. No row in the real dataset
lands in one of those windows, so a fixture built only from real data passes
whether or not the serving side gets this right. These rows are constructed to
sit inside that window on purpose.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd

from assemble import parse_clinical_row
from dataset import load_raw_dataset
from feature_matrix import FEATURE_NAMES, to_feature_vector
from features import engineer_features
from imputation import transform
from persistence import ModelPackage, load_model_package

_DATASET_PATH = Path(__file__).parent / "data" / "erbil-diabetes-dataset.csv"
_MODEL_PATH = Path(__file__).parent / "models" / "random_forest_model.pkl"
_FIXTURE_PATH = Path(__file__).parent.parent / "backend" / "src" / "ml" / "parityFixture.json"

_MAX_NEAR_THRESHOLD_ROWS = 500


def build_real_vectors(package: ModelPackage) -> list[list[float]]:
    """Build one feature vector per dataset row, exactly as serving would.

    Args:
        package: The trained package, for its training-time medians.
    Returns:
        One 13-value vector per row, in FEATURE_NAMES order.
    """
    raw = load_raw_dataset(_DATASET_PATH).to_dict("records")
    vectors = []
    for record in raw:
        row = transform(parse_clinical_row(record), package.medians)
        vectors.append(to_feature_vector(row, engineer_features(row, package.ratio_medians)))
    return [[vector[name] for name in FEATURE_NAMES] for vector in vectors]


def build_near_threshold_vectors(
    package: ModelPackage, base: list[float]
) -> list[list[float]]:
    """Build vectors sitting one float64 step above a real split threshold.

    At that value float64 says "go right" while float32 rounds back to the
    threshold and says "go left" - the disagreement the serving side has to
    resolve scikit-learn's way.

    Args:
        package: The trained package, for its forest's split thresholds.
        base: A realistic feature vector to perturb one feature at a time.
    Returns:
        One vector per distinct (feature, threshold) pair that exhibits the
        disagreement, capped at _MAX_NEAR_THRESHOLD_ROWS.
    """
    seen: set[tuple[int, float]] = set()
    vectors = []
    for estimator in package.model.estimators_:
        tree = estimator.tree_
        for node in range(tree.node_count):
            if tree.children_left[node] == -1:
                continue
            pair = (int(tree.feature[node]), float(tree.threshold[node]))
            if pair in seen:
                continue
            seen.add(pair)

            feature, threshold = pair
            value = float(np.nextafter(threshold, np.inf))
            if np.float32(value) > np.float32(threshold):
                continue

            vector = list(base)
            vector[feature] = value
            vectors.append(vector)
            if len(vectors) == _MAX_NEAR_THRESHOLD_ROWS:
                return vectors
    return vectors


def main() -> None:
    """Write both fixture sets, with scikit-learn's own predictions as ground truth."""
    package = load_model_package(_MODEL_PATH)
    real = build_real_vectors(package)
    near_threshold = build_near_threshold_vectors(package, real[0])

    def predictions(vectors: list[list[float]]) -> list[list[float]]:
        # A named-column frame, not a bare array: the model was fitted with
        # feature names, and passing an array warns about the mismatch.
        matrix = pd.DataFrame(vectors, columns=list(FEATURE_NAMES))
        return [[float(p) for p in row] for row in package.model.predict_proba(matrix)]

    fixture = {
        "modelVersion": None,
        "featureNames": list(FEATURE_NAMES),
        "real": {"vectors": real, "expected": predictions(real)},
        "nearThreshold": {
            "vectors": near_threshold,
            "expected": predictions(near_threshold),
        },
    }

    from serving_export import build_serving_model

    fixture["modelVersion"] = build_serving_model(package)["version"]

    _FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(_FIXTURE_PATH, "w") as f:
        json.dump(fixture, f)

    size_kb = _FIXTURE_PATH.stat().st_size / 1024
    print(f"real rows:           {len(real)}")
    print(f"near-threshold rows: {len(near_threshold)}")
    print(f"written:             {_FIXTURE_PATH} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
