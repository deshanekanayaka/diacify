import math
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

# The raw dataset's true maximum BMI (332.2) is a known data-entry error.
# 70 is itself a real, meaningful "severely obese" reading, so clipping to
# it preserves that signal without letting the garbled digit distort scale.
_MAX_PLAUSIBLE_BMI = 70.0

# Below this, survival isn't physiologically possible - almost certainly a
# typo, but unlike the upper bound there's no meaningful value to clip
# *down* to, so these become missing rather than an invented number.
_MIN_PLAUSIBLE_BMI = 10.0

# An RBS reading below this isn't survivable. Unlike BMI's low end, this
# isn't a general "plausible range" - it's specifically about RBS's own
# distribution, where the single value below it (1.0) is an isolated
# outlier with a large gap to the next-lowest real value (69.0).
_MIN_PLAUSIBLE_RBS = 30.0


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
    _normalize_bp_units_to_mmhg) so every returned reading is in real mmHg.

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
    return _normalize_bp_units_to_mmhg(systolic, diastolic)


def parse_bmi(raw) -> float | None:
    """Coerce a raw BMI field to a plausible numeric value.

    Args:
        raw: The raw BMI value (string or float, e.g. from a NaN CSV cell).
    Returns:
        The BMI, clipped to _MAX_PLAUSIBLE_BMI if it exceeds it, or None if
        it's unparseable, missing, or below _MIN_PLAUSIBLE_BMI.
    """
    value = parse_lab_value(raw)
    if value is None or value < _MIN_PLAUSIBLE_BMI:
        return None
    return min(value, _MAX_PLAUSIBLE_BMI)


def parse_lab_value(raw) -> float | None:
    """Coerce a raw lab field to numeric, with no plausibility bounds.

    Used for fields with no known data-entry-error pattern: an extreme
    value here is rare but medically real, unlike BMI or BP.

    Args:
        raw: The raw value (string or float, e.g. from a NaN CSV cell).
    Returns:
        The value as a float, or None if it's missing or unparseable.
    """
    value = _try_parse_float(str(raw).strip())
    if value is None or math.isnan(value):
        return None
    return value


def parse_rbs(raw) -> float | None:
    """Coerce a raw RBS (random blood sugar) field, with a survivability floor.

    Args:
        raw: The raw RBS value (string or float, e.g. from a NaN CSV cell).
    Returns:
        The value as a float, or None if it's missing, unparseable, or
        below _MIN_PLAUSIBLE_RBS.
    """
    value = parse_lab_value(raw)
    if value is None or value < _MIN_PLAUSIBLE_RBS:
        return None
    return value


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


def _normalize_bp_units_to_mmhg(
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
