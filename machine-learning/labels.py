from enum import IntEnum

from assemble import CleanRow
from features import EngineeredFeatures

# ADA 2025 Standards of Care - HbA1c diagnostic thresholds
_HBA1C_PREDIABETES = 5.7
_HBA1C_DIABETES = 6.5

# Diabetes UK guidelines - obesity threshold (hypertension already lives in
# EngineeredFeatures.hypertension_flag, reused directly below)
_BMI_OBESE = 30.0

# Elevated random blood sugar
_RBS_HIGH = 126.0

# Baneu et al., Biomedicines, 2024 - TG/HDL as insulin resistance surrogate
_TG_HDL_HIGH = 2.8

# Dyslipidaemia indicator (LDL/HDL ratio)
_LDL_HDL_HIGH = 3.5

# Minimum number of secondary flags required to trigger an upgrade
_UPGRADE_FLAG_THRESHOLD = 2


class RiskCategory(IntEnum):
    """A patient's assigned risk classification, ordered low to high."""

    LOW = 0
    MEDIUM = 1
    HIGH = 2


def base_label_from_hba1c(hba1c: float) -> RiskCategory:
    """Assign Stage A's base risk label from HbA1c alone (ADA 2025 Standards of Care).

    Depends on nothing but HbA1c, unlike the full Stage A+B rule in
    assign_label - useful anywhere a label is needed before the other
    clinical fields have gone through imputation (e.g. stratifying a
    train/test split).

    Args:
        hba1c: The patient's HbA1c value.
    Returns:
        LOW if <5.7%, MEDIUM if 5.7-6.4%, HIGH if >=6.5%.
    """
    if hba1c >= _HBA1C_DIABETES:
        return RiskCategory.HIGH
    if hba1c >= _HBA1C_PREDIABETES:
        return RiskCategory.MEDIUM
    return RiskCategory.LOW


def assign_label(row: CleanRow, features: EngineeredFeatures) -> RiskCategory:
    """Assign a risk category using the ADA 2025 base label + secondary-flag upgrade rule.

    Stage A - base label from HbA1c alone: see base_label_from_hba1c.

    Stage B - count 5 secondary clinical flags (hypertension, obesity,
    elevated RBS, high TG/HDL ratio, high LDL/HDL ratio). If 2 or more are
    raised, upgrade the base label by one tier, capped at HIGH. Never
    downgrades - a raised flag count can only push the label up.

    Args:
        row: The fully imputed clinical row.
        features: The engineered features derived from row.
    Returns:
        The assigned RiskCategory.
    """
    base_label = base_label_from_hba1c(row.hba1c)

    flag_count = sum(
        [
            features.hypertension_flag,
            row.bmi >= _BMI_OBESE,
            row.rbs >= _RBS_HIGH,
            features.tg_hdl_ratio >= _TG_HDL_HIGH,
            features.ldl_hdl_ratio >= _LDL_HDL_HIGH,
        ]
    )

    if flag_count >= _UPGRADE_FLAG_THRESHOLD:
        return RiskCategory(min(base_label.value + 1, RiskCategory.HIGH.value))
    return base_label
