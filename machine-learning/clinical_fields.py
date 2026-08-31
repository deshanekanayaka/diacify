import re

_LEADING_DIGITS = re.compile(r"\d+")

# A systolic or diastolic reading below this is physiologically impossible
# in a living patient. Rows collected early in the study recorded BP in the
# dataset's own units (roughly real mmHg / 10); later rows recorded real
# mmHg directly. A reading below this threshold is therefore a reliable
# signal that the row uses the old convention and needs scaling by 10 - the
# two clusters are actually far apart (max 18 vs min 83), so 30 sits safely
# in the gap between them.
_IMPLAUSIBLE_MMHG_THRESHOLD = 30


def parse_age(raw: str) -> float | None:
    """Extract the numeric age from a raw field like "51Years" or "27 Years".

    Args:
        raw: The raw age string from the source dataset.
    Returns:
        The parsed age, or None if no digits were present.
    """
    match = _LEADING_DIGITS.search(str(raw))
    return float(match.group()) if match else None


def parse_blood_pressure(raw: str) -> tuple[float | None, float | None]:
    """Parse a "systolic/diastolic" field into two normalized mmHg values.

    Recovers from common typos (an extra "/" or ".") by parsing each side
    independently, and corrects the dataset's two BP unit conventions (see
    _normalize_units) so every returned reading is in real mmHg.

    Args:
        raw: The raw BP string, e.g. "130/90" or "12.0/8.0".
    Returns:
        (systolic, diastolic) in mmHg. Either or both are None if that side
        couldn't be parsed (placeholder text, or a corrupted value).
    """
    # A typo can introduce an extra "/" (e.g. "13.5//9.0"); dropping empty
    # pieces recovers the intended two values without guessing at content.
    parts = [p.strip() for p in str(raw).split("/") if p.strip() != ""]
    if len(parts) != 2:
        return None, None

    systolic = _try_parse_float(parts[0])
    diastolic = _try_parse_float(parts[1])
    return _normalize_units(systolic, diastolic)


def _try_parse_float(value: str) -> float | None:
    """Parse a numeric string, returning None instead of raising.

    Args:
        value: The string to parse.
    Returns:
        The parsed float, or None if it isn't valid numeric text.
    """
    try:
        return float(value)
    except ValueError:
        return None


def _normalize_units(
    systolic: float | None, diastolic: float | None
) -> tuple[float | None, float | None]:
    """Scale dataset-unit BP readings (roughly mmHg / 10) up to real mmHg.

    Args:
        systolic: Parsed systolic value, or None.
        diastolic: Parsed diastolic value, or None.
    Returns:
        (systolic, diastolic), scaled by 10 together if either present value
        is below the implausible-mmHg threshold; otherwise unchanged.
    """
    needs_scaling = (systolic is not None and systolic < _IMPLAUSIBLE_MMHG_THRESHOLD) or (
        diastolic is not None and diastolic < _IMPLAUSIBLE_MMHG_THRESHOLD
    )
    if not needs_scaling:
        return systolic, diastolic

    scaled_systolic = systolic * 10 if systolic is not None else None
    scaled_diastolic = diastolic * 10 if diastolic is not None else None
    return scaled_systolic, scaled_diastolic
