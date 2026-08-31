from clinical_fields import parse_age, parse_blood_pressure


def test_parse_age_strips_the_years_suffix():
    assert parse_age("51Years") == 51
    assert parse_age("27 Years") == 27
    assert parse_age("64YEARS") == 64


def test_parse_age_returns_none_when_no_digits_present():
    assert parse_age("Years") is None


def test_parse_blood_pressure_reads_a_clean_pair():
    assert parse_blood_pressure("130/90") == (130.0, 90.0)


def test_parse_blood_pressure_tolerates_surrounding_whitespace():
    assert parse_blood_pressure("153 / 79") == (153.0, 79.0)


def test_parse_blood_pressure_scales_dataset_units_to_mmhg():
    # Early-collected rows recorded BP in the dataset's own units, roughly
    # real mmHg / 10 - a systolic/diastolic under 30 is impossible in a
    # living patient, so it's the signal this row needs scaling by 10.
    assert parse_blood_pressure("12.0/8.0") == (120.0, 80.0)


def test_parse_blood_pressure_does_not_rescale_values_already_in_mmhg():
    assert parse_blood_pressure("91/64") == (91.0, 64.0)
    assert parse_blood_pressure("130/90") == (130.0, 90.0)


def test_parse_blood_pressure_recovers_a_double_slash_typo():
    assert parse_blood_pressure("13.5//9.0") == (135.0, 90.0)


def test_parse_blood_pressure_recovers_the_valid_side_of_a_partial_typo():
    systolic, diastolic = parse_blood_pressure("12.0/.8.0")
    assert systolic == 120.0
    assert diastolic is None


def test_parse_blood_pressure_returns_missing_for_placeholder_junk():
    for junk in ("…", "----", "..", "nan"):
        assert parse_blood_pressure(junk) == (None, None)
