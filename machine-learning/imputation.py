from collections.abc import Sequence
from dataclasses import dataclass, replace
from statistics import median

from assemble import CleanRow

# sex and social_life are deliberately excluded: both are 0% missing in the
# real dataset, so there's no categorical-imputation behavior to design yet.
_IMPUTED_FIELDS = (
    "age",
    "systolic",
    "diastolic",
    "bmi",
    "rbs",
    "chol",
    "trig",
    "hdl",
    "ldl",
    "vldl",
    "hba1c",
    "genetics",
)


@dataclass(frozen=True)
class Medians:
    """Per-field medians computed once from a set of rows, for reuse at transform time."""

    age: float
    systolic: float
    diastolic: float
    bmi: float
    rbs: float
    chol: float
    trig: float
    hdl: float
    ldl: float
    vldl: float
    hba1c: float
    genetics: float


def fit(rows: Sequence[CleanRow]) -> Medians:
    """Compute the median of each imputable field's present values across rows.

    Args:
        rows: The rows to compute medians from - the training split, once
            one exists; the whole cleaned dataset until then.
    Returns:
        A Medians instance to pass to transform, so every row (training or
        served later) is imputed with the exact same values.
    """
    medians = {
        field: median(
            value for row in rows if (value := getattr(row, field)) is not None
        )
        for field in _IMPUTED_FIELDS
    }
    return Medians(**medians)


def transform(row: CleanRow, medians: Medians) -> CleanRow:
    """Fill a row's missing imputable fields from a fitted Medians.

    Args:
        row: The row to impute. Fields already present are left untouched.
        medians: Medians computed by fit, shared across every row so
            training and serving impute identically.
    Returns:
        A new CleanRow with every None imputable field filled in. genetics
        is rounded to the nearest int, since it's a discrete count and its
        median can be fractional.
    """
    filled = {
        field: current if (current := getattr(row, field)) is not None else getattr(medians, field)
        for field in _IMPUTED_FIELDS
    }
    filled["genetics"] = round(filled["genetics"])
    return replace(row, **filled)
