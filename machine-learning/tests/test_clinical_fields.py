import math

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


def test_parse_bmi_reads_a_plausible_value_unchanged():
    assert parse_bmi("27.6") == 27.6


def test_parse_bmi_returns_none_for_a_missing_value():
    assert parse_bmi(math.nan) is None


def test_parse_bmi_returns_none_for_garbled_text():
    # A real row in the source data: two numbers concatenated by a
    # data-entry error, with no safe way to tell which one was intended.
    assert parse_bmi("32.133.1") is None


def test_parse_bmi_clips_an_implausibly_high_value():
    # The raw dataset's true maximum (332.2) is a known data-entry error;
    # clipping preserves the "severely obese" signal without letting one
    # garbled digit distort the model's feature scale.
    assert parse_bmi("332.2") == 70.0


def test_parse_bmi_does_not_clip_a_value_at_the_upper_bound():
    assert parse_bmi("70") == 70.0


def test_parse_bmi_treats_an_implausibly_low_value_as_missing_not_clipped():
    # BMI 5.1 is below the survivable minimum (~10) - almost certainly a
    # typo, but there's no safe floor to clip it *to*, unlike the upper
    # bound where 70 is itself a real, meaningful clinical value.
    assert parse_bmi("5.1") is None


def test_parse_lab_value_reads_a_clean_number():
    assert parse_lab_value("171") == 171.0


def test_parse_lab_value_returns_none_for_missing_or_unparseable():
    assert parse_lab_value(math.nan) is None
    assert parse_lab_value("…") is None


def test_parse_lab_value_does_not_clip_extreme_but_real_values():
    # Unlike BMI/BP, there's no known data-entry-error pattern for these
    # labs - a very high triglyceride or HDL reading is rare but real, so
    # nothing here should be bounded.
    assert parse_lab_value("888") == 888.0
    assert parse_lab_value("251") == 251.0


def test_parse_rbs_reads_a_clean_number():
    assert parse_rbs("120") == 120.0


def test_parse_rbs_treats_an_implausibly_low_value_as_missing():
    # RBS of 1 mg/dL isn't survivable - an isolated outlier with a huge gap
    # to the next-lowest real value (69), same pattern as BMI's low end.
    assert parse_rbs("1") is None


def test_parse_rbs_does_not_clip_a_high_but_real_value():
    # 497 mg/dL is extreme but real for uncontrolled diabetes - unlike the
    # low end, there's no implausible-high threshold to enforce here.
    assert parse_rbs("497") == 497.0


def test_parse_sex_canonicalizes_case():
    assert parse_sex("MALE") == "male"
    assert parse_sex("FEMALE") == "female"


def test_parse_sex_returns_none_for_unrecognized_or_missing_values():
    assert parse_sex(math.nan) is None
    assert parse_sex("unknown") is None


def test_parse_social_life_canonicalizes_case():
    assert parse_social_life("city") == "city"
    assert parse_social_life("VILLAGE") == "village"


def test_parse_social_life_returns_none_for_unrecognized_or_missing_values():
    assert parse_social_life(math.nan) is None


def test_parse_genetics_counts_distinct_affected_relatives():
    assert parse_genetics("0") == 0
    assert parse_genetics("1") == 1
    assert parse_genetics("2-3") == 2
    assert parse_genetics("1-2-3") == 3


def test_parse_genetics_treats_a_doubled_zero_as_no_family_history():
    assert parse_genetics("00") == 0


def test_parse_genetics_returns_none_for_an_undocumented_code():
    # Only codes 1-4 are documented (father, mother, maternal uncle,
    # paternal uncle). "5" isn't one of them, and there's no way to know
    # whether it's a typo for a real code - so the whole value is treated
    # as unreliable rather than silently keeping the "2" and guessing.
    assert parse_genetics("5-2") is None


def test_parse_genetics_returns_none_for_missing_values():
    assert parse_genetics(math.nan) is None
