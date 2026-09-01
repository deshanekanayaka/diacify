from collections.abc import Sequence
from dataclasses import dataclass
from statistics import median

from assemble import CleanRow


@dataclass(frozen=True)
class RatioMedians:
    """Per-ratio medians computed once from rows with valid HDL, for reuse at transform time."""

    tg_hdl_ratio: float
    ldl_hdl_ratio: float


@dataclass(frozen=True)
class EngineeredFeatures:
    """Derived clinical features computed from a single fully-imputed CleanRow."""

    tg_hdl_ratio: float
    ldl_hdl_ratio: float
    hypertension_flag: bool
    age_bmi_interaction: float


def fit_ratio_medians(rows: Sequence[CleanRow]) -> RatioMedians:
    """Compute the median TG/HDL and LDL/HDL ratio across rows with valid HDL.

    Args:
        rows: The rows to compute medians from - the training split, once
            one exists; the whole cleaned, imputed dataset until then.
    Returns:
        A RatioMedians to pass to engineer_features, so a row with
        non-positive HDL falls back to the same ratio every other row
        would have used, instead of dividing by zero or a negative HDL.
    """
    valid_rows = [row for row in rows if row.hdl > 0]
    return RatioMedians(
        tg_hdl_ratio=median(row.trig / row.hdl for row in valid_rows),
        ldl_hdl_ratio=median(row.ldl / row.hdl for row in valid_rows),
    )


def engineer_features(row: CleanRow, ratio_medians: RatioMedians) -> EngineeredFeatures:
    """Derive clinical features from a single fully-imputed CleanRow.

    Args:
        row: A CleanRow with every field already imputed (see
            imputation.transform) - this function reads fields
            assuming they're present.
        ratio_medians: Medians computed by fit_ratio_medians, used as a
            fallback when this row's HDL is non-positive.
    Returns:
        The derived EngineeredFeatures for this row.
    """
    if row.hdl > 0:
        tg_hdl_ratio = row.trig / row.hdl
        ldl_hdl_ratio = row.ldl / row.hdl
    else:
        tg_hdl_ratio = ratio_medians.tg_hdl_ratio
        ldl_hdl_ratio = ratio_medians.ldl_hdl_ratio

    return EngineeredFeatures(
        tg_hdl_ratio=tg_hdl_ratio,
        ldl_hdl_ratio=ldl_hdl_ratio,
        hypertension_flag=row.systolic >= 140 or row.diastolic >= 90,
        age_bmi_interaction=row.age * row.bmi,
    )
