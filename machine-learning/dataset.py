from pathlib import Path

import pandas as pd

# The source CSV's genetics/family-history column header contains literal
# embedded newlines inside a quoted field (a data-entry artifact from the
# original collection spreadsheet), so it can't be matched by name directly.
_RAW_GENETICS_COLUMN = (
    "Fiamly \n1)father\n2) mather \n3)uncle(mother's side)\n4)uncle(father's side) "
)


def load_raw_dataset(path: Path) -> pd.DataFrame:
    """Read the source CSV into a DataFrame with clean, stable column names.

    Args:
        path: Location of the raw Erbil dataset CSV.
    Returns:
        All 662 rows, unmodified except for column-name cleanup (the
        malformed genetics header is renamed to "genetics_raw"). No
        numeric parsing, imputation, or filtering happens here.
    """
    if not Path(path).exists():
        raise FileNotFoundError(f"Dataset not found at {path}")

    df = pd.read_csv(path)
    df.columns = [col.strip() for col in df.columns]
    df = df.rename(columns={_RAW_GENETICS_COLUMN.strip(): "genetics_raw"})
    return df
