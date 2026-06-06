from dotenv import load_dotenv

load_dotenv()
import os
import pickle

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field, field_validator

MODEL_VERSION = "v1"

# ---------------------------------------------------------------------------
# INTERNAL SECRET AUTHENTICATION
#
# The ML service is not publicly accessible — it is an internal service
# called only by the Express backend. Every request must include:
#   X-Internal-Secret: <value matching ML_INTERNAL_SECRET env variable>
#
# Requests missing this header or with a wrong value are rejected with 403.
# The secret is never hardcoded — it is read from the environment at startup.
# The same secret must be set in the backend's environment variables.
# ---------------------------------------------------------------------------
INTERNAL_SECRET = os.environ.get("ML_INTERNAL_SECRET", "")

api_key_header = APIKeyHeader(name="X-Internal-Secret", auto_error=False)


def verify_internal_secret(api_key: str = Security(api_key_header)):
    """
    Dependency injected into every protected endpoint.
    Returns the key if valid. Raises 403 if missing or wrong.
    Raises 500 at startup if ML_INTERNAL_SECRET env var is not set —
    running without a secret in production is a misconfiguration.
    """
    if not INTERNAL_SECRET:
        raise HTTPException(
            status_code=500,
            detail="ML service misconfigured: ML_INTERNAL_SECRET environment variable is not set.",
        )
    if api_key != INTERNAL_SECRET:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: missing or invalid X-Internal-Secret header.",
        )
    return api_key


# CLINICAL THRESHOLDS

# ADA 2025 Standards of Care
HBA1C_PREDIABETES = 5.7
HBA1C_DIABETES = 6.5

# Diabetes UK guidelines
BP_SYSTOLIC_HIGH = 140  # mmHg
BP_DIASTOLIC_HIGH = 90  # mmHg

# Diabetes UK guidelines
BMI_OBESE = 30.0  # kg/m²

# Elevated random blood sugar
RBS_HIGH = 126.0  # mg/dL

# Baneu et al., Biomedicines, 2024
TG_HDL_HIGH = 2.8

# Dyslipidaemia indicator
LDL_HDL_HIGH = 3.5

# Physiological BMI cap — must match train_model.py
BMI_MAX_PLAUSIBLE = 70.0

# Low confidence threshold — if max class probability is below this,
# the response includes low_confidence: true so the clinician is warned
LOW_CONFIDENCE_THRESHOLD = 0.40

app = FastAPI(
    title="Diacify ML Service",
    description=(
        "Random Forest risk classification for Diacify. "
        "Internal service — not publicly accessible. "
        "All requests require X-Internal-Secret header."
    ),
    version=MODEL_VERSION,
)

# CORS
BACKEND_ORIGIN = os.environ.get("BACKEND_ORIGIN", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[BACKEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["X-Internal-Secret", "Content-Type"],
)

MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "models", "random_forest_model.pkl"
)

try:
    with open(MODEL_PATH, "rb") as f:
        model_package = pickle.load(f)
        model = model_package["model"]
        FEATURE_NAMES = model_package["feature_names"]
    print(f"Model loaded: {MODEL_PATH}")
    print(f"Features ({len(FEATURE_NAMES)}): {FEATURE_NAMES}")
except FileNotFoundError:
    print(f"Model file not found at {MODEL_PATH}")
    print("Run train_model.py to generate random_forest_model.pkl")
    model = None
    FEATURE_NAMES = []


class PatientData(BaseModel):
    """
    Clinical measurements for a single patient visit.
    All blood pressure values are in real mmHg — not dataset encoding units.
    The frontend and backend must send real mmHg (e.g. 120, not 12.0).
    """

    age: int = Field(..., ge=0, le=120, description="Age in years")
    sex: str = Field(..., description="'male' or 'female'")
    hba1c: float = Field(..., ge=0, le=20, description="HbA1c percentage")
    bmi: float = Field(..., ge=10, le=70, description="BMI kg/m²")
    bp_systolic: float = Field(
        ..., ge=60, le=250, description="Systolic BP in real mmHg (e.g. 120)"
    )
    bp_diastolic: float = Field(
        ..., ge=40, le=150, description="Diastolic BP in real mmHg (e.g. 80)"
    )
    rbs: float = Field(..., ge=0, le=600, description="Random blood sugar mg/dL")
    triglycerides: float = Field(..., ge=0, le=2000, description="Triglycerides mg/dL")
    hdl: float = Field(..., ge=0, le=200, description="HDL cholesterol mg/dL")
    ldl: float = Field(..., ge=0, le=300, description="LDL cholesterol mg/dL")
    genetics: int = Field(
        ..., ge=0, le=4, description="Count of affected relatives (0=none, 1–4)"
    )

    @field_validator("sex")
    @classmethod
    def validate_sex(cls, v):
        """Accepts any capitalisation — stores as lowercase for consistent encoding."""
        if v.lower() not in ["male", "female"]:
            raise ValueError("sex must be 'male' or 'female'")
        return v.lower()

    @field_validator("bmi")
    @classmethod
    def cap_bmi(cls, v):
        """
        Cap BMI at BMI_MAX_PLAUSIBLE to match training preprocessing.
        Values above 70 are data entry errors — cap rather than reject
        so the visit record is not lost due to a single bad measurement.
        """
        return min(v, BMI_MAX_PLAUSIBLE)


# RESPONSE SCHEMA
class RiskPrediction(BaseModel):
    risk_score: float  # 0–100
    risk_category: str  # low / medium / high
    confidence_low: float  # % probability for Low class
    confidence_medium: float  # % probability for Medium class
    confidence_high: float  # % probability for High class
    top_factors: list[str]  # top contributing feature names
    low_confidence: bool  # True if max class probability < 0.40
    model_version: str  # e.g. "v1" — for audit trail


# PREPROCESSING


def preprocess_patient_data(data: PatientData) -> pd.DataFrame:
    # Encode sex
    sex_encoded = 1 if data.sex == "male" else 0

    # Engineered features — must use same thresholds as train_model.py
    tg_hdl_ratio = (data.triglycerides / data.hdl) if data.hdl > 0 else 0.0
    ldl_hdl_ratio = (data.ldl / data.hdl) if data.hdl > 0 else 0.0
    hypertension_flag = int(
        data.bp_systolic >= BP_SYSTOLIC_HIGH or data.bp_diastolic >= BP_DIASTOLIC_HIGH
    )
    age_bmi_interaction = data.age * data.bmi

    # Build a dict with every possible feature name, then select + order
    # using FEATURE_NAMES from the model package — so if features ever
    # change on retrain, this code adapts automatically.
    feature_dict = {
        "HbA1c": data.hba1c,
        "Age": data.age,
        "Sex_Encoded": sex_encoded,
        "BMI": data.bmi,
        "BP_Systolic": data.bp_systolic,
        "BP_Diastolic": data.bp_diastolic,
        "RBS": data.rbs,
        "TG_HDL_ratio": tg_hdl_ratio,
        "LDL_HDL_ratio": ldl_hdl_ratio,
        "Trig": data.triglycerides,
        "HDL": data.hdl,
        "Genetics_Encoded": data.genetics,
        "hypertension_flag": hypertension_flag,
        "age_bmi_interaction": age_bmi_interaction,
    }

    df = pd.DataFrame([feature_dict])
    return df[FEATURE_NAMES]


# SCORE CALCULATION
def calculate_risk_score(probabilities: np.ndarray, predicted_class: int) -> float:
    """
    Maps class probabilities to a 0–100 risk score with three bands:
      High   class: 70–100  (scaled by P(High))
      Medium class: 40–69   (scaled by P(Medium))
      Low    class:  0–39   (scaled by P(Low))

    Within each band, a higher confidence probability produces a higher
    score — so two High patients can be ranked against each other.
    """
    prob_low = probabilities[0]
    prob_medium = probabilities[1]
    prob_high = probabilities[2]

    if predicted_class == 2:
        return 70 + (prob_high * 30)
    elif predicted_class == 1:
        return 40 + (prob_medium * 30)
    else:
        return prob_low * 39


def calculate_risk_category(risk_score: float) -> str:
    if risk_score >= 70:
        return "high"
    elif risk_score >= 40:
        return "medium"
    else:
        return "low"


def get_top_factors(n: int = 3) -> list[str]:
    """
    Returns the n features with the highest global importance weights
    from the trained model.

    KNOWN LIMITATION: these are global (model-level) importances, not
    patient-specific. Every patient with the same predicted class receives
    the same top_factors list. True patient-specific explanations would
    require SHAP values — documented as a future improvement.
    The frontend should label this section "Key risk indicators" rather
    than "Factors specific to this patient" to avoid overclaiming.
    """
    importance_df = pd.DataFrame(
        {
            "feature": FEATURE_NAMES,
            "importance": model.feature_importances_,
        }
    ).sort_values("importance", ascending=False)

    return importance_df["feature"].head(n).tolist()


# ENDPOINTS


@app.get("/")
def health_check():
    """
    Public health check — no secret required.
    Used by the backend GET /health endpoint to verify ML service reachability.
    Returns model load status and version so the backend can surface this
    in its own health response.
    """
    return {
        "service": "Diacify ML Service",
        "status": "running",
        "model_version": MODEL_VERSION,
        "model_loaded": model is not None,
        "feature_count": len(FEATURE_NAMES),
        "features": FEATURE_NAMES,
    }


@app.post("/predict", response_model=RiskPrediction)
def predict_risk(
    patient: PatientData,
    _secret: str = Security(verify_internal_secret),
):
    """
    Accepts a patient's clinical measurements and returns a risk score,
    category, class confidences, top contributing features, and a
    low-confidence flag.

    Protected by X-Internal-Secret header — callable only by the backend.
    Returns 503 if model failed to load at startup.
    Returns 403 if secret header is missing or wrong.
    Returns 422 if input validation fails (Pydantic).
    Returns 500 if prediction itself fails unexpectedly.
    """
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="ML model not loaded. Run train_model.py to generate random_forest_model.pkl.",
        )

    try:
        processed = preprocess_patient_data(patient)

        predicted_class = model.predict(processed)[0]
        probabilities = model.predict_proba(processed)[0]

        risk_score = calculate_risk_score(probabilities, predicted_class)
        risk_category = calculate_risk_category(risk_score)
        top_factors = get_top_factors(n=3)

        # Low confidence: if the model is not at least 40% confident in any
        # single class, the clinician should verify manually rather than
        # acting on the score alone.
        max_probability = float(np.max(probabilities))
        low_confidence = max_probability < LOW_CONFIDENCE_THRESHOLD

        return RiskPrediction(
            risk_score=round(risk_score, 2),
            risk_category=risk_category,
            confidence_low=round(float(probabilities[0]) * 100, 2),
            confidence_medium=round(float(probabilities[1]) * 100, 2),
            confidence_high=round(float(probabilities[2]) * 100, 2),
            top_factors=top_factors,
            low_confidence=low_confidence,
            model_version=MODEL_VERSION,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}",
        )


# LOCAL DEV ENTRY POINT

if __name__ == "__main__":
    import uvicorn

    print("Starting Diacify ML Service")
    print(f"Model version: {MODEL_VERSION}")
    print(f"Backend origin allowed: {BACKEND_ORIGIN}")
    uvicorn.run(app, host="0.0.0.0", port=8001)

# ---------------------------------------------------------------------------
# References
# ---------------------------------------------------------------------------
# ADA Standards of Care 2025 — HbA1c thresholds (5.7%, 6.5%)
# Diabetes UK — BP threshold (140/90 mmHg), BMI obesity threshold (30 kg/m²)
# Baneu et al., Biomedicines, 2024 — TG/HDL ratio as insulin resistance surrogate
# Alsadi et al., BMC Medical Informatics, 2024 — RF for diabetes classification
# Erbil Diabetes Dataset, Mendeley, 2024 — DOI: 10.17632/3snnp89967.1
