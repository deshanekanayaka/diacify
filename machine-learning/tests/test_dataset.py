from pathlib import Path

from dataset import load_raw_dataset

DATASET_PATH = Path(__file__).parent.parent / "data" / "erbil-diabetes-dataset.csv"


def test_loads_every_row():
    df = load_raw_dataset(DATASET_PATH)
    assert len(df) == 662


def test_genetics_column_is_renamed_and_not_split_across_columns():
    df = load_raw_dataset(DATASET_PATH)
    assert "genetics_raw" in df.columns
    # The raw header contains embedded newlines inside a quoted field; a
    # parser that doesn't respect CSV quoting would see this as several
    # columns instead of one.
    assert not any("father" in col for col in df.columns if col != "genetics_raw")


def test_genetics_values_survive_the_rename_unchanged():
    df = load_raw_dataset(DATASET_PATH)
    # Row 2 (0-indexed) is a known non-trivial value ("2-4") in the raw file.
    assert df["genetics_raw"].iloc[2] == "2-4"


def test_column_names_have_no_surrounding_whitespace():
    df = load_raw_dataset(DATASET_PATH)
    assert all(col == col.strip() for col in df.columns)


def test_raises_a_clear_error_if_the_file_is_missing():
    import pytest

    with pytest.raises(FileNotFoundError):
        load_raw_dataset(Path("does/not/exist.csv"))
