from assemble import CleanRow
from features import EngineeredFeatures

# Matches legacy's validated 14-feature set (docs/phase-1-investigation.md,
# train_model.py). Chol, VLDL, and social_life are deliberately excluded -
# legacy found no predictive value in them.
FEATURE_NAMES = (
    "hba1c",
    "age",
    "sex_encoded",
    "bmi",
    "systolic",
    "diastolic",
    "rbs",
    "tg_hdl_ratio",
    "ldl_hdl_ratio",
    "trig",
    "hdl",
    "genetics",
    "hypertension_flag",
    "age_bmi_interaction",
)


def to_feature_vector(row: CleanRow, features: EngineeredFeatures) -> dict[str, float]:
    """Build the model's input feature vector from a clean row and its engineered features.

    Args:
        row: A fully imputed CleanRow (see imputation.transform).
        features: The EngineeredFeatures derived from row.
    Returns:
        A dict with one float per FEATURE_NAMES entry, in order. sex_encoded
        is 1.0 for "male", 0.0 for "female" - a modeling-only encoding;
        CleanRow.sex itself stays the domain string.
    """
    return {
        "hba1c": row.hba1c,
        "age": row.age,
        "sex_encoded": 1.0 if row.sex == "male" else 0.0,
        "bmi": row.bmi,
        "systolic": row.systolic,
        "diastolic": row.diastolic,
        "rbs": row.rbs,
        "tg_hdl_ratio": features.tg_hdl_ratio,
        "ldl_hdl_ratio": features.ldl_hdl_ratio,
        "trig": row.trig,
        "hdl": row.hdl,
        "genetics": float(row.genetics),
        "hypertension_flag": 1.0 if features.hypertension_flag else 0.0,
        "age_bmi_interaction": features.age_bmi_interaction,
    }
