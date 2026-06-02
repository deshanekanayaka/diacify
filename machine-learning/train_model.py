import json
import os
import pickle
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)
from sklearn.model_selection import (
    GridSearchCV,
    StratifiedKFold,
    cross_val_score,
    train_test_split,
)

df = pd.read_csv("Dabetics-dataset.csv")
for col in df.columns:
    print(repr(col))
# ---------------------------------------------------------------------------
# Column name for the genetics / family history field.
# The raw CSV has a long, typo-ridden header — we rename it immediately after
# loading so the rest of the code can reference it cleanly.
# ---------------------------------------------------------------------------
GENETICS_RAW_COL = (
    "Fiamly \n1)father\n2) mather \n3)uncle(mother's side)\n4)uncle(father's side) "
)

# ---------------------------------------------------------------------------
# FBS EXCLUSION NOTE
# FBS (Fasting Blood Sugar) is present in the dataset but has 96.5% missingness
# — only 23 of 662 records contain a value. A column with this level of
# missingness provides no reliable signal and would introduce systematic bias
# (only patients with FBS recorded would influence that feature's learning).
# FBS is therefore excluded from all preprocessing and model training.
# Reference: standard ML practice for features with >50% missingness.
# ---------------------------------------------------------------------------

# ADA 2025 Standards of Care — HbA1c diagnostic thresholds
HBA1C_PREDIABETES = 5.7  # ADA 2025: prediabetes lower bound
HBA1C_DIABETES = 6.5  # ADA 2025: diabetes diagnostic threshold

# Diabetes UK guidelines — hypertension threshold
BP_SYSTOLIC_HIGH = 140  # mmHg
BP_DIASTOLIC_HIGH = 90  # mmHg

# Diabetes UK guidelines — obesity threshold
BMI_OBESE = 30.0  # kg/m²

# Elevated random blood sugar
RBS_HIGH = 126.0  # mg/dL

# Baneu et al., Biomedicines, 2024 — TG/HDL as insulin resistance surrogate
# AUC 0.88 for insulin resistance detection
TG_HDL_HIGH = 2.8

# Dyslipidaemia indicator (LDL/HDL ratio)
LDL_HDL_HIGH = 3.5

# Physiological BMI cap — values above this are data entry errors
BMI_MAX_PLAUSIBLE = 70.0

# Minimum number of secondary flags required to trigger an upgrade
UPGRADE_FLAG_THRESHOLD = 2


# ---------------------------------------------------------------------------
# STEP 1 — LOAD AND PREPROCESS
# ---------------------------------------------------------------------------


def load_and_preprocess_data(csv_path):
    """
    Loads the Erbil Diabetes Dataset and applies all preprocessing steps
    in a fixed, documented order before any model training occurs.

    Steps (in order):
      1. Rename the genetics column
      2. Drop FBS and unnamed index columns
      3. Strip column name whitespace
      4. Parse Age strings
      5. Parse and NORMALISE BP (two encoding formats exist in this dataset)
      6. Convert BMI to numeric and cap outliers
      7. Median-impute missing values
      8. Encode Sex as binary
      9. Encode Genetics as family member count
      10. Compute four engineered features
      11. Assign ADA 2025 grounded risk labels
    """
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} patient records")

    # Step 1 — rename the genetics column before anything else references it
    df = df.rename(columns={GENETICS_RAW_COL: "Genetics"})

    # Step 2 — drop columns that must not be used
    # FBS: 96.5% missing — see exclusion note at top of file
    # Unnamed: 0 and Visit_ID: row index artefacts, not clinical features
    cols_to_drop = [c for c in ["Unnamed: 0", "Visit_ID", "FBS"] if c in df.columns]
    df = df.drop(columns=cols_to_drop)

    # Step 3 — strip whitespace from all column names
    df.columns = df.columns.str.strip()

    # Step 4 — parse Age: remove "Years"/"Year" text, convert to integer
    df["Age"] = (
        df["Age"]
        .str.replace("Years", "", case=False)
        .str.replace("Year", "", case=False)
        .str.strip()
    )
    df["Age"] = pd.to_numeric(df["Age"], errors="coerce")

    # Step 5 — parse BP and NORMALISE to real mmHg
    #
    # CRITICAL: The Erbil dataset contains two BP encoding formats mixed
    # across rows:
    #   - Early rows  (approx 1–267): dataset units, e.g. "12.0/8.0"
    #     meaning 120/80 mmHg (divide by 10 to get mmHg, or multiply × 10
    #     to convert from dataset unit to mmHg)
    #   - Later rows (approx 268–528): real mmHg, e.g. "130/90"
    #
    # Detection rule: if the parsed systolic value is < 30, it cannot be a
    # real blood pressure (no physiological systolic is below 30 mmHg) —
    # it must be in dataset units. Multiply both columns by 10.
    #
    # Rows already in real mmHg are left unchanged.
    bp_split = df["BP"].str.split("/", expand=True)
    df["BP_Systolic"] = pd.to_numeric(bp_split[0], errors="coerce")
    df["BP_Diastolic"] = pd.to_numeric(bp_split[1], errors="coerce")

    dataset_unit_mask = df["BP_Systolic"] < 30
    df.loc[dataset_unit_mask, "BP_Systolic"] *= 10
    df.loc[dataset_unit_mask, "BP_Diastolic"] *= 10

    print(
        f"  BP normalisation: {dataset_unit_mask.sum()} rows converted from "
        f"dataset units to real mmHg"
    )

    # Step 6 — BMI: convert to numeric, cap physiological outliers
    # The dataset contains a maximum BMI of 332.2 — a data entry error.
    # Values above {BMI_MAX_PLAUSIBLE} are capped, not dropped, to preserve
    # all other measurements on those rows.
    df["BMI"] = pd.to_numeric(df["BMI"], errors="coerce")
    outlier_count = (df["BMI"] > BMI_MAX_PLAUSIBLE).sum()
    df["BMI"] = df["BMI"].clip(upper=BMI_MAX_PLAUSIBLE)
    if outlier_count > 0:
        print(f"  BMI: {outlier_count} outlier(s) capped at {BMI_MAX_PLAUSIBLE}")

    # Step 7 — median imputation for columns with missing values
    for col in [
        "Age",
        "BP_Systolic",
        "BP_Diastolic",
        "BMI",
        "RBS",
        "HDL",
        "LDL",
        "Trig",
    ]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        n_missing = df[col].isna().sum()
        if n_missing > 0:
            df[col] = df[col].fillna(df[col].median())
            print(f"  Imputed {n_missing} missing value(s) in '{col}' with median")

    # Step 8 — encode Sex as binary numeric
    # MALE = 1, FEMALE = 0
    df["Sex_Encoded"] = df["Sex"].str.strip().str.upper().map({"MALE": 1, "FEMALE": 0})

    # Step 9 — encode Genetics as count of affected relatives
    #
    # Raw values are strings like "0", "1-2-3", "2-4" where each number
    # represents a different type of affected relative.
    # We count the number of distinct values listed.
    # "0" means no family history → 0 relatives.
    # "1-2-3" means three types of relative affected → 3.
    # This converts an unreadable categorical string into a meaningful
    # ordinal: more relatives = stronger family history signal.
    def count_genetics(val):
        val = str(val).strip()
        if val == "0" or val == "" or val.lower() == "nan":
            return 0
        parts = [p for p in val.split("-") if p.strip() != "0" and p.strip() != ""]
        return len(parts)

    df["Genetics_Encoded"] = df["Genetics"].apply(count_genetics)

    # Step 10 — compute four engineered features
    #
    # TG/HDL ratio: surrogate marker for insulin resistance
    # Source: Baneu et al., Biomedicines, 2024 (AUC 0.88)
    df["TG_HDL_ratio"] = np.where(df["HDL"] > 0, df["Trig"] / df["HDL"], np.nan)
    df["TG_HDL_ratio"] = df["TG_HDL_ratio"].fillna(df["TG_HDL_ratio"].median())

    # LDL/HDL ratio: dyslipidaemia indicator
    df["LDL_HDL_ratio"] = np.where(df["HDL"] > 0, df["LDL"] / df["HDL"], np.nan)
    df["LDL_HDL_ratio"] = df["LDL_HDL_ratio"].fillna(df["LDL_HDL_ratio"].median())

    # Hypertension flag: binary — 1 if BP meets hypertension threshold
    # Threshold: Diabetes UK BP guidelines
    df["hypertension_flag"] = (
        (df["BP_Systolic"] >= BP_SYSTOLIC_HIGH)
        | (df["BP_Diastolic"] >= BP_DIASTOLIC_HIGH)
    ).astype(int)

    # Age-BMI interaction: captures non-linear combined risk of age + obesity
    df["age_bmi_interaction"] = df["Age"] * df["BMI"]

    # Step 11 — assign ADA 2025 grounded risk labels
    df["Risk_Category"] = df.apply(assign_label, axis=1)

    print()
    print("Preprocessing complete")
    print("Risk label distribution:")
    label_map = {0: "Low", 1: "Medium", 2: "High"}
    for code, name in label_map.items():
        count = (df["Risk_Category"] == code).sum()
        pct = count / len(df) * 100
        print(f"  {name:>6}: {count:>4} patients ({pct:.1f}%)")
    print(f"  Expected approximately: Low ~60%, Medium ~24%, High ~16%")

    return df


# ---------------------------------------------------------------------------
# STEP 2 — ADA 2025 GROUNDED LABELLING
# ---------------------------------------------------------------------------


def assign_label(row):
    """
    Assigns a risk category label (0=Low, 1=Medium, 2=High) to a single
    patient row using a two-stage process:

    Stage A — base label from HbA1c (ADA 2025 Standards of Care):
      < 5.7%        → Low    (normal)
      5.7% – 6.4%   → Medium (prediabetes)
      ≥ 6.5%        → High   (diabetes diagnostic threshold)

    Stage B — secondary upgrade rule:
      Count how many of the five clinical flags below are raised.
      If 2 or more flags are raised, upgrade the label one tier.
      Labels can only increase, never decrease.

    The five flags and their evidence base:
      1. Hypertension   — systolic ≥ 140 OR diastolic ≥ 90  (Diabetes UK)
      2. Obesity        — BMI ≥ 30                           (Diabetes UK)
      3. Elevated RBS   — RBS ≥ 126 mg/dL
      4. TG/HDL ratio   — ≥ 2.8                             (Baneu et al., 2024)
      5. LDL/HDL ratio  — ≥ 3.5

    The threshold of 2+ flags (not 1) avoids upgrading patients on the
    basis of a single borderline measurement.
    """

    # Stage A — base label from HbA1c
    hba1c = row["HbA1c"]
    if hba1c >= HBA1C_DIABETES:
        base_label = 2
    elif hba1c >= HBA1C_PREDIABETES:
        base_label = 1
    else:
        base_label = 0

    # Stage B — count secondary flags
    flag_count = 0

    # Flag 1: hypertension
    if (
        row["BP_Systolic"] >= BP_SYSTOLIC_HIGH
        or row["BP_Diastolic"] >= BP_DIASTOLIC_HIGH
    ):
        flag_count += 1

    # Flag 2: obesity
    if row["BMI"] >= BMI_OBESE:
        flag_count += 1

    # Flag 3: elevated random blood sugar
    if row["RBS"] >= RBS_HIGH:
        flag_count += 1

    # Flag 4: TG/HDL ratio (insulin resistance surrogate)
    if row["TG_HDL_ratio"] >= TG_HDL_HIGH:
        flag_count += 1

    # Flag 5: LDL/HDL ratio (dyslipidaemia)
    if row["LDL_HDL_ratio"] >= LDL_HDL_HIGH:
        flag_count += 1

    # Apply upgrade rule — never downgrade
    if flag_count >= UPGRADE_FLAG_THRESHOLD:
        final_label = min(base_label + 1, 2)
    else:
        final_label = base_label

    return final_label


# ---------------------------------------------------------------------------
# STEP 3 — FEATURE PREPARATION
# ---------------------------------------------------------------------------


def prepare_features(df):
    """
    Selects the 14 model input features.

    Features excluded:
      - FBS: 96.5% missing — see exclusion note at top of file
      - Chol, VLDL: low individual predictive power (MDI < 0.05 per
        literature). Lipid ratios (TG_HDL_ratio, LDL_HDL_ratio) are
        more powerful than individual components.
      - Social Life: residence type — not a clinical measurement
      - Raw BP string: replaced by BP_Systolic + BP_Diastolic
    """
    print()
    print("Preparing features")

    feature_columns = [
        "HbA1c",
        "Age",
        "Sex_Encoded",
        "BMI",
        "BP_Systolic",
        "BP_Diastolic",
        "RBS",
        "TG_HDL_ratio",
        "LDL_HDL_ratio",
        "Trig",
        "HDL",
        "Genetics_Encoded",
        "hypertension_flag",
        "age_bmi_interaction",
    ]

    x = df[feature_columns]
    y = df["Risk_Category"]

    print(f"  Feature count: {len(feature_columns)}")
    print(f"  Feature matrix shape: {x.shape}")
    print(f"  Features: {feature_columns}")

    return x, y, feature_columns


# ---------------------------------------------------------------------------
# STEP 4 — TRAIN / TEST SPLIT
# (unchanged from original — stratify preserves class proportions)
# ---------------------------------------------------------------------------


def split_data(x, y):
    print()
    print("Splitting data (80/20 stratified)")

    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"  Training set: {x_train.shape}")
    print(f"  Testing set:  {x_test.shape}")

    return x_train, x_test, y_train, y_test


# ---------------------------------------------------------------------------
# STEP 5 — BASELINE MODEL
# (class_weight='balanced' added to handle class imbalance ~60/24/16 split)
# ---------------------------------------------------------------------------


def fit_and_evaluate_model(
    x_train,
    x_test,
    y_train,
    y_test,
    max_depth=5,
    min_samples_split=0.01,
    max_features=0.8,
    max_samples=0.8,
):
    print()
    print("Training baseline model")

    rf = RandomForestClassifier(
        random_state=0,
        max_depth=max_depth,
        min_samples_split=min_samples_split,
        max_features=max_features,
        max_samples=max_samples,
        class_weight="balanced",  # handles ~60/24/16 class imbalance
    )

    model = rf.fit(x_train, y_train)
    y_pred = model.predict(x_test)

    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))
    print()
    print(f"Accuracy: {accuracy_score(y_test, y_pred) * 100:.2f}%")
    print()
    print(classification_report(y_test, y_pred, target_names=["Low", "Medium", "High"]))

    return model


# ---------------------------------------------------------------------------
# STEP 6 — HYPERPARAMETER TUNING
# (unchanged from original)
# ---------------------------------------------------------------------------


def hyperparameter_tuning(x_train, y_train):
    print()
    print("Hyperparameter tuning with GridSearchCV")

    param_grid = [
        {
            "max_depth": [3, 5, 7, 10],
            "min_samples_split": [0.01, 0.03, 0.07, 0.1],
            "max_features": [0.7, 0.8, 0.9, 1.0],
            "max_samples": [0.7, 0.8, 0.9, 1.0],
            "class_weight": ["balanced"],
        }
    ]

    model = RandomForestClassifier(random_state=0)
    search = GridSearchCV(estimator=model, param_grid=param_grid, cv=3, verbose=1)
    search.fit(x_train, y_train)

    print()
    print("Best parameters:")
    for param, value in search.best_params_.items():
        print(f"  {param}: {value}")
    print(f"Best CV score: {search.best_score_ * 100:.2f}%")

    return search


# ---------------------------------------------------------------------------
# STEP 7 — RESULTS ANALYSIS
# (unchanged from original)
# ---------------------------------------------------------------------------


def analyze_results(search):
    print()
    print("Top 10 parameter combinations:")

    results = pd.DataFrame(search.cv_results_)
    results.sort_values("mean_test_score", ascending=False, inplace=True)

    top10 = results[
        [
            "mean_test_score",
            "std_test_score",
            "rank_test_score",
            "param_max_depth",
            "param_max_features",
            "param_max_samples",
            "param_min_samples_split",
        ]
    ].head(10)
    print(top10.to_string(index=False))

    return results


# ---------------------------------------------------------------------------
# STEP 8 — K-FOLD CROSS-VALIDATION
# (unchanged from original)
# ---------------------------------------------------------------------------


def k_fold_validation(model, x, y):
    print()
    print("K-fold cross-validation (5-fold stratified)")

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(model, x, y, cv=skf, scoring="accuracy")

    print(f"  Fold scores:        {[f'{s:.4f}' for s in cv_scores]}")
    print(
        f"  Mean accuracy:      {cv_scores.mean():.4f} ({cv_scores.mean() * 100:.2f}%)"
    )
    print(
        f"  Std deviation:      {cv_scores.std():.4f} (±{cv_scores.std() * 100:.2f}%)"
    )
    print(f"  Min / Max:          {cv_scores.min():.4f} / {cv_scores.max():.4f}")

    return cv_scores


# ---------------------------------------------------------------------------
# STEP 9 — FEATURE IMPORTANCE
# (unchanged from original)
# ---------------------------------------------------------------------------


def feature_importance_analysis(model, feature_columns):
    print()
    print("Feature importance ranking:")

    fi = pd.DataFrame(
        {
            "feature": feature_columns,
            "importance": model.feature_importances_,
        }
    ).sort_values("importance", ascending=False)

    for rank, (_, row) in enumerate(fi.iterrows(), 1):
        print(f"  {rank:>2}. {row['feature']:<25} {row['importance']:.4f}")

    return fi


# ---------------------------------------------------------------------------
# STEP 10 — BIAS AUDIT
# ---------------------------------------------------------------------------


def bias_audit(model, x_test, y_test, feature_columns):
    """
    Evaluates model performance broken down by demographic subgroups.

    Groups audited:
      - Sex: Male (Sex_Encoded = 1) vs Female (Sex_Encoded = 0)
      - Age group: Under 40 / 40–60 / Over 60

    For each group, prints per-class precision, recall, and F1.
    Results are returned as a dict for inclusion in model_metadata.json.

    This audit checks for systematic performance differences that could
    indicate the model is less reliable for certain patient groups.
    """
    print()
    print("Bias audit — performance by subgroup")

    y_pred = model.predict(x_test)
    audit_results = {}

    x_test_reset = x_test.reset_index(drop=True)
    y_test_reset = y_test.reset_index(drop=True)
    y_pred_series = pd.Series(y_pred, index=y_test_reset.index)

    # --- By Sex ---
    for sex_val, sex_label in [(1, "Male"), (0, "Female")]:
        mask = x_test_reset["Sex_Encoded"] == sex_val
        if mask.sum() == 0:
            continue
        report = classification_report(
            y_test_reset[mask],
            y_pred_series[mask],
            target_names=["Low", "Medium", "High"],
            output_dict=True,
            zero_division=0,
        )
        audit_results[f"sex_{sex_label.lower()}"] = report
        print(f"\n  Sex = {sex_label} (n={mask.sum()})")
        print(f"  {'Class':<8} {'Precision':>10} {'Recall':>8} {'F1':>8}")
        for cls in ["Low", "Medium", "High"]:
            r = report[cls]
            print(
                f"  {cls:<8} {r['precision']:>10.3f} {r['recall']:>8.3f} {r['f1-score']:>8.3f}"
            )

    # --- By Age Group ---
    age_groups = [
        ("under_40", x_test_reset["Age"] < 40, "Age < 40"),
        (
            "age_40_60",
            (x_test_reset["Age"] >= 40) & (x_test_reset["Age"] <= 60),
            "Age 40–60",
        ),
        ("over_60", x_test_reset["Age"] > 60, "Age > 60"),
    ]

    for group_key, mask, label in age_groups:
        if mask.sum() == 0:
            continue
        report = classification_report(
            y_test_reset[mask],
            y_pred_series[mask],
            target_names=["Low", "Medium", "High"],
            output_dict=True,
            zero_division=0,
        )
        audit_results[f"age_{group_key}"] = report
        print(f"\n  {label} (n={mask.sum()})")
        print(f"  {'Class':<8} {'Precision':>10} {'Recall':>8} {'F1':>8}")
        for cls in ["Low", "Medium", "High"]:
            r = report[cls]
            print(
                f"  {cls:<8} {r['precision']:>10.3f} {r['recall']:>8.3f} {r['f1-score']:>8.3f}"
            )

    return audit_results


# ---------------------------------------------------------------------------
# STEP 11 — SAVE MODEL + METADATA
# ---------------------------------------------------------------------------


def save_model(
    model,
    feature_columns,
    cv_scores,
    y_test,
    x_test,
    feature_importance,
    audit_results,
    output_path="models/random_forest_model.pkl",
):
    """
    Saves two artefacts:

    1. random_forest_model.pkl — the trained model + feature_names list
       bundled together. feature_names travel with the model so app.py
       always uses the correct feature set without manual edits.

    2. model_metadata.json — human-readable record of this training run:
       training date, dataset size, CV accuracy, per-class metrics,
       feature importances, and bias audit results.
       Used for audit trail, version tracking, and examiner transparency.
    """
    print()
    print("Saving model artefacts")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Save pkl
    model_package = {
        "model": model,
        "feature_names": feature_columns,
    }
    with open(output_path, "wb") as f:
        pickle.dump(model_package, f)

    file_size = os.path.getsize(output_path) / 1024
    print(f"  Model saved: {output_path} ({file_size:.1f} KB)")

    # Build and save metadata JSON
    y_pred = model.predict(x_test)
    report = classification_report(
        y_test,
        y_pred,
        target_names=["Low", "Medium", "High"],
        output_dict=True,
        zero_division=0,
    )

    metadata = {
        "training_date": datetime.now().isoformat(),
        "dataset_size": int(len(y_test) * 5),  # approximate full set from 80/20 split
        "test_set_size": int(len(y_test)),
        "labelling_method": "ADA 2025 HbA1c thresholds + five-flag composite upgrade rule",
        "fbs_excluded": True,
        "fbs_exclusion_reason": "96.5% missing (23 of 662 records) — statistically unreliable",
        "cv_mean_accuracy": round(float(cv_scores.mean()), 4),
        "cv_std": round(float(cv_scores.std()), 4),
        "cv_fold_scores": [round(float(s), 4) for s in cv_scores],
        "per_class_metrics": {
            "Low": {
                k: round(report["Low"][k], 4)
                for k in ["precision", "recall", "f1-score", "support"]
            },
            "Medium": {
                k: round(report["Medium"][k], 4)
                for k in ["precision", "recall", "f1-score", "support"]
            },
            "High": {
                k: round(report["High"][k], 4)
                for k in ["precision", "recall", "f1-score", "support"]
            },
        },
        "feature_importances": {
            row["feature"]: round(float(row["importance"]), 4)
            for _, row in feature_importance.iterrows()
        },
        "bias_audit": audit_results,
        "clinical_thresholds": {
            "hba1c_prediabetes": HBA1C_PREDIABETES,
            "hba1c_diabetes": HBA1C_DIABETES,
            "bp_systolic_high": BP_SYSTOLIC_HIGH,
            "bp_diastolic_high": BP_DIASTOLIC_HIGH,
            "bmi_obese": BMI_OBESE,
            "rbs_high": RBS_HIGH,
            "tg_hdl_high": TG_HDL_HIGH,
            "ldl_hdl_high": LDL_HDL_HIGH,
            "upgrade_flag_threshold": UPGRADE_FLAG_THRESHOLD,
        },
    }

    metadata_path = os.path.join(os.path.dirname(output_path), "model_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  Metadata saved: {metadata_path}")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------


def main():
    print()
    print("=" * 60)
    print("Diabetic Patient Priority System — Model Training")
    print("=" * 60)

    CSV_PATH = "Dabetics-dataset.csv"

    if not os.path.exists(CSV_PATH):
        print(f"\nError: Dataset not found at '{CSV_PATH}'")
        print("Place the Erbil Diabetes Dataset CSV in the same directory.")
        return

    # Preprocessing + labelling
    df = load_and_preprocess_data(CSV_PATH)

    # Feature selection
    x, y, feature_columns = prepare_features(df)

    # Train / test split
    x_train, x_test, y_train, y_test = split_data(x, y)

    # Baseline model
    print()
    print("=" * 40)
    print("Baseline model")
    print("=" * 40)
    fit_and_evaluate_model(x_train, x_test, y_train, y_test)

    # Hyperparameter search
    search = hyperparameter_tuning(x_train, y_train)
    analyze_results(search)

    # Evaluate best model
    print()
    print("=" * 40)
    print("Best model evaluation")
    print("=" * 40)
    best_model = search.best_estimator_

    y_pred_best = best_model.predict(x_test)
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred_best))
    print()
    print(f"Accuracy: {accuracy_score(y_test, y_pred_best) * 100:.2f}%")
    print()
    print(
        classification_report(
            y_test, y_pred_best, target_names=["Low", "Medium", "High"]
        )
    )

    # Cross-validation
    cv_scores = k_fold_validation(best_model, x, y)

    # Feature importance
    feature_importance = feature_importance_analysis(best_model, feature_columns)

    # Bias audit
    audit_results = bias_audit(best_model, x_test, y_test, feature_columns)

    # Save model + metadata
    save_model(
        model=best_model,
        feature_columns=feature_columns,
        cv_scores=cv_scores,
        y_test=y_test,
        x_test=x_test,
        feature_importance=feature_importance,
        audit_results=audit_results,
    )

    print()
    print("=" * 60)
    print("Training complete")
    print(
        f"  CV accuracy: {cv_scores.mean() * 100:.2f}% (±{cv_scores.std() * 100:.2f}%)"
    )
    print(f"  Test accuracy: {accuracy_score(y_test, y_pred_best) * 100:.2f}%")
    print()
    print("Next step: uvicorn app:app --reload --port 8001")
    print("=" * 60)
    print()


if __name__ == "__main__":
    main()


# ---------------------------------------------------------------------------
# References
# ---------------------------------------------------------------------------
# ADA Standards of Care 2025 — HbA1c thresholds (5.7%, 6.5%)
# Diabetes UK — BP threshold (140/90 mmHg), BMI obesity threshold (30 kg/m²)
# Baneu et al., Biomedicines, 2024 — TG/HDL ratio as insulin resistance
#   surrogate, AUC 0.88
# Alsadi et al., BMC Medical Informatics, 2024 — RF superiority for diabetes
# Ashisha et al., IJCIS, 2024 — RF achieves 92–94% accuracy
# Ooka et al., BMJ Nutrition, 2021 — RF outperforms MLR for HbA1c prediction
# Shahraki et al., JRMS, 2025 — HbA1c + lipid panel as optimal feature set
# Erbil Diabetes Dataset, Mendeley, 2024 — DOI: 10.17632/3snnp89967.1
