from collections.abc import Sequence
from dataclasses import dataclass

from sklearn.model_selection import train_test_split

import features
import imputation
from assemble import CleanRow
from feature_matrix import to_feature_vector
from labels import RiskCategory, assign_label, base_label_from_hba1c

# Matches legacy's split_data (train_model.py): 80/20, stratified, fixed seed.
_TEST_SIZE = 0.2
_RANDOM_STATE = 42


@dataclass(frozen=True)
class TrainTestData:
    """A leakage-safe train/test split, ready for model fitting and evaluation.

    x_train/x_test are lists of feature vectors (see feature_matrix.to_feature_vector);
    y_train/y_test are the matching RiskCategory labels. medians and
    ratio_medians were fit on the training rows only, and are carried
    here so a trained model can be shipped alongside the exact
    preprocessing statistics it was evaluated with.
    """

    x_train: list[dict[str, float]]
    y_train: list[RiskCategory]
    x_test: list[dict[str, float]]
    y_test: list[RiskCategory]
    medians: imputation.Medians
    ratio_medians: features.RatioMedians


def split_rows(
    rows: Sequence[CleanRow],
    test_size: float = _TEST_SIZE,
    random_state: int = _RANDOM_STATE,
) -> tuple[list[CleanRow], list[CleanRow]]:
    """Split rows into a stratified train/test pair.

    Stratifies by base_label_from_hba1c rather than the full two-stage
    label, since HbA1c is the one field guaranteed present pre-imputation -
    stratifying here must not depend on statistics that are only safe to
    compute after the split exists.

    Args:
        rows: The parsed (not yet imputed) rows to split.
        test_size: Fraction of rows held out for testing.
        random_state: Seed for reproducibility.
    Returns:
        (train_rows, test_rows).
    """
    strata = [base_label_from_hba1c(row.hba1c) for row in rows]
    train_rows, test_rows = train_test_split(
        list(rows), test_size=test_size, random_state=random_state, stratify=strata
    )
    return train_rows, test_rows


def prepare_train_test_data(rows: Sequence[CleanRow]) -> TrainTestData:
    """Split, impute, engineer, and label rows with no test-set leakage.

    Imputation medians and ratio medians are fit on the training split
    only, then used to transform both splits - the test set never
    influences a statistic anything is evaluated against.

    Args:
        rows: The parsed (not yet imputed) rows for the whole dataset.
    Returns:
        A TrainTestData ready for model fitting and evaluation.
    """
    train_rows, test_rows = split_rows(rows)

    medians = imputation.fit(train_rows)
    train_imputed = [imputation.transform(row, medians) for row in train_rows]
    test_imputed = [imputation.transform(row, medians) for row in test_rows]

    ratio_medians = features.fit_ratio_medians(train_imputed)
    train_engineered = [features.engineer_features(row, ratio_medians) for row in train_imputed]
    test_engineered = [features.engineer_features(row, ratio_medians) for row in test_imputed]

    train_pairs = list(zip(train_imputed, train_engineered, strict=True))
    test_pairs = list(zip(test_imputed, test_engineered, strict=True))

    return TrainTestData(
        x_train=[to_feature_vector(r, f) for r, f in train_pairs],
        y_train=[assign_label(r, f) for r, f in train_pairs],
        x_test=[to_feature_vector(r, f) for r, f in test_pairs],
        y_test=[assign_label(r, f) for r, f in test_pairs],
        medians=medians,
        ratio_medians=ratio_medians,
    )
