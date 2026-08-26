import sys
import os
import json
import pickle
import pandas as pd
import numpy as np

# Add Model directory to path to locate EnhancedGroundwaterPreprocessor
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(current_dir, '../Model'))

from train_enhanced_model import EnhancedGroundwaterPreprocessor

# Fix for pickling class mapping issue
sys.modules['__main__'].EnhancedGroundwaterPreprocessor = EnhancedGroundwaterPreprocessor

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"status": "error", "message": "Usage: run_predictions_bridge.py <input_json_path> <output_json_path>"}))
        sys.exit(1)
        
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(input_path):
        print(json.dumps({"status": "error", "message": f"Input file not found: {input_path}"}))
        sys.exit(1)
        
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            payload = json.load(f)
            
        # Load models
        gwl_model_path = os.path.join(current_dir, "../Model/enhanced_groundwater_pipeline.pkl")
        recharge_model_path = os.path.join(current_dir, "../Model/recharge_model.pkl")
        
        with open(gwl_model_path, "rb") as f:
            gwl_pipeline = pickle.load(f)
            
        with open(recharge_model_path, "rb") as f:
            recharge_pipeline = pickle.load(f)
            
        recharge_reg = recharge_pipeline['recharge_regressor']
        extraction_reg = recharge_pipeline['extraction_regressor']
        
        results = []
        
        # We process predictions in batches
        for item in payload:
            scope = item['scope'] # 'district' or 'village'
            year = item['year']
            month = item.get('month', 6)
            
            # Predict Recharge & Extraction (District-level models)
            # Input features: ['district_id', 'annual_rainfall', 'average_soil_moisture']
            dist_id = item['district_id']
            rainfall = item['rainfall_mm']
            soil_moist = item.get('soil_moisture', 0.25)
            
            recharge_in = pd.DataFrame([[dist_id, rainfall, soil_moist]], columns=['district_id', 'annual_rainfall', 'average_soil_moisture'])
            pred_recharge = float(recharge_reg.predict(recharge_in)[0])
            pred_extraction = float(extraction_reg.predict(recharge_in)[0])
            
            # Scale down BCM metrics for village level if village scope
            if scope == 'village':
                scale_fraction = 0.008 + (item['village_id'] % 5) * 0.001
                pred_recharge = pred_recharge * scale_fraction
                pred_extraction = pred_extraction * scale_fraction
                
            extractable = pred_recharge * 0.91
            stage = (pred_extraction / extractable) * 100 if extractable > 0 else 0
            
            # Determine category
            category = 'Safe'
            if stage >= 100: category = 'Over Exploited'
            elif stage >= 90: category = 'Critical'
            elif stage >= 70: category = 'Semi Critical'
            
            # Predict DTW using enhanced_groundwater_pipeline
            # Input features: ['District', 'Tehsil', 'Block', 'Station', 'Latitude', 'Longitude', 'Year', 'Month']
            # Optionally: Last_GWL, Elevation, API_Rainfall, Soil_Moisture (preprocessor fills them if not provided)
            gwl_in = pd.DataFrame([{
                'District': item['district_name'],
                'Tehsil': item.get('tehsil', item['district_name']),
                'Block': item.get('block', item['district_name']),
                'Station': item.get('station_name', item['name']),
                'Latitude': float(item['latitude']),
                'Longitude': float(item['longitude']),
                'Year': int(year),
                'Month': int(month)
            }])
            
            pred_gwl = float(gwl_pipeline.predict(gwl_in)[0])
            
            # Bound prediction to reasonable limits
            pred_gwl = max(0.5, min(75.0, pred_gwl))
            
            results.append({
                "id": item.get('village_id') if scope == 'village' else item['district_id'],
                "scope": scope,
                "year": year,
                "recharge_bcm": float(pred_recharge),
                "extraction_all_uses_bcm": float(pred_extraction),
                "extractable_resources_bcm": float(extractable),
                "natural_discharges_bcm": float(pred_recharge * 0.09),
                "rainfall_mm": float(rainfall),
                "category": category,
                "dtw_m_bgl": float(round(pred_gwl, 2))
            })
            
        # Write output
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({"status": "success", "data": results}, f, indent=2)
            
        print("Success")
        sys.exit(0)
    except Exception as e:
        print(f"Error during prediction: {e}", file=sys.stderr)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({"status": "error", "message": str(e)}, f)
        sys.exit(1)

if __name__ == "__main__":
    main()
