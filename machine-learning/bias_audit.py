from collections.abc import Sequence

from sklearn.base import ClassifierMixin
from sklearn.metrics import classification_report

from labels import RiskCategory
from model import to_label_array, to_training_matrix

_CLASS_NAMES = ["Low", "Medium", "High"]

# Matches legacy's bias_audit groups exactly (train_model.py).
_AGE_UNDER_40 = 40.0
_AGE_OVER_60 = 60.0


def audit_bias(
    model: ClassifierMixin,
    x_test: Sequence[dict[str, float]],
    y_test: Sequence[RiskCategory],
) -> dict[str, dict]:
    """Break down model performance by sex and age subgroup.

    Groups: sex_male/sex_female (from sex_encoded), and
    age_under_40/age_40_60/age_over_60 (from age). Checks for systematic
    performance differences that could indicate the model is less
    reliable for certain patient groups. A group with no members in
    x_test is omitted.

    Args:
        model: A fitted classifier.
        x_test: Held-out feature vectors.
        y_test: Matching held-out labels.
    Returns:
        A dict keyed by group name, each value a classification_report
        (precision/recall/F1 per class).
    """
    y_true = to_label_array(y_test)
    y_pred = model.predict(to_training_matrix(x_test)).tolist()

    groups = {
        "sex_male": [i for i, v in enumerate(x_test) if v["sex_encoded"] == 1.0],
        "sex_female": [i for i, v in enumerate(x_test) if v["sex_encoded"] == 0.0],
        "age_under_40": [i for i, v in enumerate(x_test) if v["age"] < _AGE_UNDER_40],
        "age_40_60": [
            i for i, v in enumerate(x_test) if _AGE_UNDER_40 <= v["age"] <= _AGE_OVER_60
        ],
        "age_over_60": [i for i, v in enumerate(x_test) if v["age"] > _AGE_OVER_60],
    }

    results = {}
    for group_name, indices in groups.items():
        if not indices:
            continue
        results[group_name] = classification_report(
            [y_true[i] for i in indices],
            [y_pred[i] for i in indices],
            labels=[category.value for category in RiskCategory],
            target_names=_CLASS_NAMES,
            output_dict=True,
            zero_division=0,
        )
    return results
