from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from clinical_fields import (
    parse_age,
    parse_blood_pressure,
    parse_bmi,
    parse_genetics,
    parse_lab_value,
    parse_rbs,
    parse_sex,
    parse_social_life,
)


@dataclass(frozen=True)
class CleanRow:
    """One patient record, fully parsed and typed but not yet imputed."""

    age: float | None
    systolic: float | None
    diastolic: float | None
    bmi: float | None
    rbs: float | None
    chol: float | None
    trig: float | None
    hdl: float | None
    ldl: float | None
    vldl: float | None
    hba1c: float | None
    sex: str | None
    social_life: str | None
    genetics: int | None


def parse_clinical_row(raw: Mapping[str, Any]) -> CleanRow:
    """Parse one raw dataset record into a fully typed CleanRow.

    Dispatches each raw column to its corresponding field parser. Leaves
    missing or unparseable values as None - imputation happens later, in
    a separate stage.

    Args:
        raw: One record from the raw dataset, keyed by raw column name
            (as produced by dataset.py::load_raw_dataset).
    Returns:
        The parsed CleanRow.
    """
    systolic, diastolic = parse_blood_pressure(raw["BP"])
    return CleanRow(
        age=parse_age(raw["Age"]),
        systolic=systolic,
        diastolic=diastolic,
        bmi=parse_bmi(raw["BMI"]),
        rbs=parse_rbs(raw["RBS"]),
        chol=parse_lab_value(raw["Chol"]),
        trig=parse_lab_value(raw["Trig"]),
        hdl=parse_lab_value(raw["HDL"]),
        ldl=parse_lab_value(raw["LDL"]),
        vldl=parse_lab_value(raw["VLDL"]),
        hba1c=parse_lab_value(raw["HbA1c"]),
        sex=parse_sex(raw["Sex"]),
        social_life=parse_social_life(raw["Social Life"]),
        genetics=parse_genetics(raw["genetics_raw"]),
    )
