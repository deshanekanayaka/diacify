from assemble import CleanRow, parse_clinical_row

_VALID_RAW_ROW = {
    "Age": "51Years",
    "BP": "130/90",
    "BMI": "27.4",
    "RBS": "140",
    "Chol": "180",
    "Trig": "150",
    "HDL": "45",
    "LDL": "100",
    "VLDL": "30",
    "HbA1c": "6.1",
    "Sex": "MALE",
    "Social Life": "city",
    "genetics_raw": "1-2",
}


def test_parses_every_field_from_a_fully_populated_row():
    assert parse_clinical_row(_VALID_RAW_ROW) == CleanRow(
        age=51.0,
        systolic=130.0,
        diastolic=90.0,
        bmi=27.4,
        rbs=140.0,
        chol=180.0,
        trig=150.0,
        hdl=45.0,
        ldl=100.0,
        vldl=30.0,
        hba1c=6.1,
        sex="male",
        social_life="city",
        genetics=2,
    )


def test_missing_or_unparseable_values_pass_through_as_none():
    raw = {**_VALID_RAW_ROW, "Age": "Years", "BP": "not/valid/bp", "Sex": float("nan")}
    row = parse_clinical_row(raw)
    assert row.age is None
    assert row.systolic is None
    assert row.diastolic is None
    assert row.sex is None
