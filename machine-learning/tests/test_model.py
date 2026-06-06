import os
import pickle
import pytest
from fastapi.testclient import TestClient
from app import app


TEST_SECRET = os.environ.get("ML_INTERNAL_SECRET", "test_secret")
client = TestClient(app)


def _valid_payload(**overrides):
    """Return a valid prediction payload with optional overrides."""
    base = {
        "age": 40, "sex": "male",
        "bp_systolic": 120.0, "bp_diastolic": 80.0,
        "cholesterol": 190.0, "triglycerides": 120.0,
        "hdl": 50.0, "ldl": 110.0, "vldl": 24.0,
        "hba1c": 5.4, "bmi": 24.0, "rbs": 100.0,
        "genetics": 0, "social_life": "city",
    }
    base.update(overrides)
    return base


def _model_path():
    """Find the .pkl file in the models directory."""
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    models_dir = os.path.join(base, 'models')
    for fname in os.listdir(models_dir):
        if fname.endswith('.pkl'):
            return os.path.join(models_dir, fname)
    raise FileNotFoundError(f"No .pkl file found in {models_dir}")


def test_model_loads_with_expected_keys():
    """Test that the trained model artifact has required keys."""
    model_path = _model_path()
    with open(model_path, 'rb') as f:
        artifact = pickle.load(f)
    
    assert 'model' in artifact, "Artifact must contain 'model' key"
    assert 'feature_names' in artifact, "Artifact must contain 'feature_names' key"
    assert len(artifact['feature_names']) > 0, "Feature names list must not be empty"


def test_high_hba1c_predicts_high_risk():
    """Test that HbA1c 7.2% predicts high risk (ADA 2025 diabetes threshold ≥6.5%)."""
    payload = _valid_payload(hba1c=7.2)
    response = client.post("/predict", json=payload, headers={"X-Internal-Secret": TEST_SECRET})
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert data['risk_category'] == 'high', f"Expected 'high' risk, got {data['risk_category']}"


def test_normal_hba1c_predicts_low_risk():
    """Test that HbA1c 5.4% predicts low risk (below ADA 2025 prediabetes threshold 5.7%)."""
    payload = _valid_payload(hba1c=5.4)
    response = client.post("/predict", json=payload, headers={"X-Internal-Secret": TEST_SECRET})
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert data['risk_category'] == 'low', f"Expected 'low' risk, got {data['risk_category']}"


def test_predict_response_schema():
    """Test that /predict endpoint returns the complete response schema."""
    payload = _valid_payload(hba1c=6.2)
    response = client.post("/predict", json=payload, headers={"X-Internal-Secret": TEST_SECRET})
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    
    # Check all 7 required fields are present
    required_fields = [
        'risk_score', 'risk_category', 'confidence_low',
        'confidence_medium', 'confidence_high', 'top_factors', 'low_confidence'
    ]
    for field in required_fields:
        assert field in data, f"Response missing required field: {field}"
    
    # Validate field types and values
    assert isinstance(data['risk_score'], (int, float)), "risk_score must be a number"
    assert data['risk_category'] in ('low', 'medium', 'high'), \
        f"risk_category must be 'low', 'medium', or 'high', got {data['risk_category']}"
    assert isinstance(data['top_factors'], list), "top_factors must be a list"
    assert isinstance(data['low_confidence'], bool), "low_confidence must be a boolean"
    assert 0 <= data['risk_score'] <= 100, "risk_score must be between 0 and 100"
