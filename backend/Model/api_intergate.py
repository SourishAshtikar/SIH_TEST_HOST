import pickle
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from train_enhanced_model import EnhancedGroundwaterPreprocessor

# Fix for pickling issue
sys.modules['__main__'].EnhancedGroundwaterPreprocessor = EnhancedGroundwaterPreprocessor

app = FastAPI(title="Enhanced Groundwater & Recharge Prediction API")

# Request Model for existing GWL predict
class GroundwaterRequest(BaseModel):
    District: str
    Tehsil: str
    Block: str
    Station: str
    Latitude: float
    Longitude: float
    Year: int
    Month: int
    Last_GWL: float = None
    Elevation: float = None
    API_Rainfall: float = None
    Soil_Moisture: float = None

# Request Model for Recharge predict
class RechargeRequest(BaseModel):
    district_id: int
    annual_rainfall: float
    average_soil_moisture: float

# Request Model for Technique recommend
class RecommendationRequest(BaseModel):
    recharge_bcm: float
    extraction_bcm: float
    soil_texture: str
    crop_requirement: str
    annual_rainfall: float

pipeline = None
recharge_pipeline = None
technique_classifier = None

@app.on_event("startup")
def load_model():
    global pipeline, recharge_pipeline, technique_classifier
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    gwl_model_path = os.path.join(current_dir, "enhanced_groundwater_pipeline.pkl")
    recharge_model_path = os.path.join(current_dir, "recharge_model.pkl")
    technique_model_path = os.path.join(current_dir, "technique_model.pkl")
    
    # 1. Load existing GWL pipeline
    try:
        with open(gwl_model_path, "rb") as f:
            pipeline = pickle.load(f)
        print("Enhanced Groundwater Pipeline loaded successfully!")
    except Exception as e:
        print(f"Error loading enhanced GWL model: {e}")
        
    # 2. Load Recharge Regressors
    try:
        with open(recharge_model_path, "rb") as f:
            recharge_pipeline = pickle.load(f)
        print("Recharge & Extraction models loaded successfully!")
    except Exception as e:
        print(f"Error loading recharge model: {e}")
        
    # 3. Load Technique Classifier
    try:
        with open(technique_model_path, "rb") as f:
            technique_classifier = pickle.load(f)
        print("Technique Classifier model loaded successfully!")
    except Exception as e:
        print(f"Error loading technique model: {e}")

# Existing GWL prediction endpoint
@app.post("/predict")
def predict(request: GroundwaterRequest):
    if pipeline is None:
        raise HTTPException(status_code=500, detail="GWL Model is not loaded")
    try:
        input_data = pd.DataFrame([request.dict(exclude_none=True)])
        prediction = pipeline.predict(input_data)
        return {
            "status": "success", 
            "predicted_gwl_meters": float(prediction[0])
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Recharge prediction endpoint
@app.post("/predict-recharge")
def predict_recharge(request: RechargeRequest):
    if recharge_pipeline is None:
        raise HTTPException(status_code=500, detail="Recharge Model is not loaded")
    try:
        # Features: ['district_id', 'annual_rainfall', 'average_soil_moisture']
        feat_df = pd.DataFrame([[
            request.district_id,
            request.annual_rainfall,
            request.average_soil_moisture
        ]], columns=['district_id', 'annual_rainfall', 'average_soil_moisture'])
        
        recharge_reg = recharge_pipeline['recharge_regressor']
        extraction_reg = recharge_pipeline['extraction_regressor']
        
        pred_recharge = float(recharge_reg.predict(feat_df)[0])
        pred_extraction = float(extraction_reg.predict(feat_df)[0])
        
        extractable = pred_recharge * 0.91
        stage = (pred_extraction / extractable) * 100 if extractable > 0 else 0
        
        category = 'Safe'
        if stage >= 100: category = 'Over Exploited'
        elif stage >= 90: category = 'Critical'
        elif stage >= 70: category = 'Semi Critical'
        
        return {
            "status": "success",
            "recharge_bcm": pred_recharge,
            "extraction_all_uses_bcm": pred_extraction,
            "extractable_resources_bcm": extractable,
            "stage_of_groundwater_extraction": stage,
            "category": category
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Irrigation technique recommendation endpoint
@app.post("/recommend-technique")
def recommend_technique(request: RecommendationRequest):
    if technique_classifier is None:
        raise HTTPException(status_code=500, detail="Technique classifier Model is not loaded")
    try:
        # Mapping soil texture and crop water requirements
        soil_map = {'coarse': 0, 'medium': 1, 'fine': 2}
        crop_map = {'low': 0, 'medium': 1, 'high': 2}
        
        soil_val = soil_map.get(request.soil_texture.lower(), 1)
        crop_val = crop_map.get(request.crop_requirement.lower(), 1)
        
        # Features: ['recharge_bcm', 'extraction_bcm', 'soil_texture', 'crop_requirement', 'annual_rainfall']
        feat_df = pd.DataFrame([[
            request.recharge_bcm,
            request.extraction_bcm,
            soil_val,
            crop_val,
            request.annual_rainfall
        ]], columns=['recharge_bcm', 'extraction_bcm', 'soil_texture', 'crop_requirement', 'annual_rainfall'])
        
        prediction = technique_classifier.predict(feat_df)[0]
        probs = technique_classifier.predict_proba(feat_df)[0]
        confidence = float(np.max(probs) * 100)
        
        # Formulate ML reasoning text based on predicted category stress
        reasons = []
        stage = (request.extraction_bcm / request.recharge_bcm) * 100 if request.recharge_bcm > 0 else 100
        
        if prediction == 'Drip':
            reasons = [
                f"ML model selected Drip Irrigation with {confidence:.1f}% confidence.",
                f"Groundwater extraction is high relative to recharge (Stage of extraction: {stage:.1f}%).",
                f"Crop water requirement class is High/Medium, requiring highly targeted micro-irrigation.",
                f"Soil texture ({request.soil_texture}) is compatible with low-loss drip lines."
            ]
        elif prediction == 'Sprinkler':
            reasons = [
                f"ML model selected Sprinkler Irrigation with {confidence:.1f}% confidence.",
                f"Annual rainfall is moderate (~{request.annual_rainfall:.1f}mm), allowing sprinkler coverage.",
                f"Soil type ({request.soil_texture}) is well-suited for pressurized overhead sprinkling.",
                f"Saves significant water compared to traditional flood methods."
            ]
        else:
            reasons = [
                f"ML model recommended maintaining current practices ({prediction}) with {confidence:.1f}% confidence.",
                "Groundwater recharge is healthy, and extraction levels are safe.",
                "Standard routine water conservation measures are sufficient."
            ]
            
        return {
            "status": "success",
            "recommended_practice": prediction,
            "confidence_score": confidence,
            "reasons": reasons
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)