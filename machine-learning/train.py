from collections.abc import Sequence
from pathlib import Path

from assemble import CleanRow, parse_clinical_row
from bias_audit import audit_bias
from cross_validation import cross_validate_model
from dataset import load_raw_dataset
from feature_importance import rank_feature_importance
from feature_matrix import FEATURE_NAMES
from hyperparameter_search import PARAM_GRID, search_hyperparameters
from model import evaluate_model
from persistence import ModelPackage, build_metadata, save_metadata, save_model_package
from split import prepare_train_test_data

_DATASET_PATH = Path(__file__).parent / "data" / "erbil-diabetes-dataset.csv"
_MODEL_PATH = Path(__file__).parent / "models" / "random_forest_model.pkl"
_METADATA_PATH = Path(__file__).parent / "models" / "model_metadata.json"


def train_and_evaluate(
    rows: Sequence[CleanRow], param_grid=PARAM_GRID
) -> tuple[ModelPackage, dict]:
    """Run the full pipeline from parsed rows to a persisted-ready model + metadata.

    Pure orchestration - every step is already tested independently
    (split, hyperparameter search, evaluation, cross-validation, feature
    importance, bias audit); this just calls them in order and packages
    the results. No printing or file I/O here - see main() for that.

    Args:
        rows: Parsed (not yet imputed) rows - see assemble.parse_clinical_row.
        param_grid: The hyperparameter grid to search - PARAM_GRID by
            default; tests pass a smaller grid for speed.
    Returns:
        (package, metadata) - package is ready for save_model_package,
        metadata is ready for save_metadata.
    """
    data = prepare_train_test_data(rows)

    search = search_hyperparameters(data.x_train, data.y_train, param_grid=param_grid)
    best_model = search.best_estimator_

    evaluation = evaluate_model(best_model, data.x_test, data.y_test)
    cv_result = cross_validate_model(best_model, data.x_train, data.y_train)
    importance = rank_feature_importance(best_model)
    bias_results = audit_bias(best_model, data.x_test, data.y_test)

    package = ModelPackage(
        model=best_model,
        feature_names=FEATURE_NAMES,
        medians=data.medians,
        ratio_medians=data.ratio_medians,
    )
    metadata = build_metadata(
        dataset_size=len(rows),
        test_set_size=len(data.y_test),
        cv_result=cv_result,
        evaluation=evaluation,
        feature_importance=importance,
        bias_audit_results=bias_results,
    )
    return package, metadata


def main() -> None:
    """Load the real dataset, train, evaluate, and persist the model."""
    df = load_raw_dataset(_DATASET_PATH)
    rows = [parse_clinical_row(row) for row in df.to_dict("records")]

    print(f"Loaded {len(rows)} rows from {_DATASET_PATH.name}")
    print("Training and evaluating (this runs the full hyperparameter grid search)...")

    package, metadata = train_and_evaluate(rows)

    save_model_package(package, _MODEL_PATH)
    save_metadata(metadata, _METADATA_PATH)

    print()
    print(f"Model saved:    {_MODEL_PATH}")
    print(f"Metadata saved: {_METADATA_PATH}")
    print()
    print(f"Test accuracy:     {metadata['test_accuracy'] * 100:.2f}%")
    print(
        f"CV mean accuracy:  {metadata['cv_mean_accuracy'] * 100:.2f}% "
        f"(+/-{metadata['cv_std'] * 100:.2f}%)"
    )
    print()
    print("Feature importance:")
    for rank, (name, score) in enumerate(metadata["feature_importances"].items(), 1):
        print(f"  {rank:>2}. {name:<22} {score:.4f}")


if __name__ == "__main__":
    main()
