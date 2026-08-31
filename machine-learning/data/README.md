# Dataset provenance

`erbil-diabetes-dataset.csv` — Erbil Diabetes Dataset, Mendeley Data,
DOI [10.17632/3snnp89967.1](https://data.mendeley.com/datasets/3snnp89967/1).
662 patient records collected in the Kurdistan Region of Iraq.

This is the same source dataset used by the legacy Diacify project
(see `docs/phase-1-investigation.md`). No preprocessing has been applied to
this file — it is the raw download, byte-for-byte.

Known raw-format quirks (relevant to anyone loading this file directly, not
just via `dataset.py`):
- The genetics/family-history column's header contains literal embedded
  newline characters inside a quoted CSV field, so naive line-counting tools
  (`wc -l`) will overcount by 4 lines. A CSV-aware parser (pandas, Excel,
  etc.) reads this correctly as one header row.
