import os
import json
import pickle
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline

# District normalization lookup
district_map = {
    'CHARKI DADRI': 'Charkhi Dadri',
    'CHARKHI DADRI': 'Charkhi Dadri',
    'MEWAT': 'Nuh',
    'NUH': 'Nuh',
    'GURGAON': 'Gurugram',
    'GURUGRAM': 'Gurugram',
    'SONEPAT': 'Sonipat',
    'SONIPAT': 'Sonipat',
    'YAMUNA NAGAR': 'Yamunanagar',
    'YAMUNANAGAR': 'Yamunanagar'
}

def normalize_district(name):
    if not name:
        return ''
    u_name = str(name).strip().upper()
    return district_map.get(u_name, str(name).strip().title())

def main():
    print("=== Training Groundwater Recharge & Technique Suggestion ML Models ===")
    
    # 1. Load database snapshot
    db_data_path = 'Model/db_historical_data.json'
    if not os.path.exists(db_data_path):
        print(f"Error: Snapshot not found at {db_data_path}")
        return
        
    with open(db_data_path, 'r', encoding='utf-8') as f:
        db_snapshot = json.load(f)
        
    districts_list = db_snapshot['districts']
    villages_list = db_snapshot['villages']
    historical_assessments = db_snapshot['assessments']
    
    # 2. Load daily datasets
    df_r = pd.read_csv('Dataset/rainfall_haryana_2018_2025.csv', encoding='utf-8')
    df_sm = pd.read_csv('Dataset/soil_moisture_haryana_2018_2025.csv', encoding='utf-8')
    
    # Normalize district names in CSVs
    df_r['Norm_District'] = df_r['District'].apply(normalize_district)
    df_sm['Norm_District'] = df_sm['District'].apply(normalize_district)
    
    # Aggregate rainfall to annual sum
    df_r_annual = df_r.groupby(['Norm_District', 'Year'])['Avg_rainfall'].sum().reset_index()
    df_r_annual.rename(columns={'Avg_rainfall': 'Annual_Rainfall'}, inplace=True)
    
    # Aggregate soil moisture to annual mean
    df_sm_annual = df_sm.groupby(['Norm_District', 'Year'])['Avg_smlvl_at15cm'].mean().reset_index()
    df_sm_annual.rename(columns={'Avg_smlvl_at15cm': 'Average_Soil_Moisture'}, inplace=True)
    
    # Merge annual features
    df_features = pd.merge(df_r_annual, df_sm_annual, on=['Norm_District', 'Year'], how='inner')
    
    # Map district list
    district_name_to_id = {d['name'].lower(): d['district_id'] for d in districts_list}
    df_features['District_ID'] = df_features['Norm_District'].str.lower().map(district_name_to_id)
    df_features = df_features.dropna(subset=['District_ID'])
    df_features['District_ID'] = df_features['District_ID'].astype(int)
    
    print(f"Features loaded: {len(df_features)} annual records.")
    
    # 3. Create Training Set for Recharge and Extraction Models
    # Map historical assessments: years "2023-2024" -> 2023, "2024-2025" -> 2024
    training_rows = []
    for ha in historical_assessments:
        if ha['district_id'] is None:
            continue # Skip village level for training baseline models
            
        start_year = int(ha['assessment_year'].split('-')[0])
        dist_id = ha['district_id']
        
        # Match features
        feat_match = df_features[(df_features['District_ID'] == dist_id) & (df_features['Year'] == start_year)]
        if len(feat_match) > 0:
            row = feat_match.iloc[0]
            training_rows.append({
                'district_id': dist_id,
                'year': start_year,
                'annual_rainfall': row['Annual_Rainfall'],
                'average_soil_moisture': row['Average_Soil_Moisture'],
                'recharge_bcm': ha['recharge_bcm'],
                'extraction_bcm': ha['extraction_all_uses_bcm'],
                'extractable_bcm': ha['extractable_resources_bcm']
            })
            
    df_train = pd.DataFrame(training_rows)
    print(f"Aligned training samples: {len(df_train)}")
    
    if len(df_train) == 0:
        print("Error: No training rows aligned. Check mapping of district names.")
        return
        
    # Train Recharge & Extraction RF Regressors
    X_train = df_train[['district_id', 'annual_rainfall', 'average_soil_moisture']]
    y_recharge = df_train['recharge_bcm']
    y_extraction = df_train['extraction_bcm']
    
    recharge_model = RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42)
    recharge_model.fit(X_train, y_recharge)
    
    extraction_model = RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42)
    extraction_model.fit(X_train, y_extraction)
    
    # Save the recharge/extraction regressors pipeline
    with open('Model/recharge_model.pkl', 'wb') as f:
        pickle.dump({
            'recharge_regressor': recharge_model,
            'extraction_regressor': extraction_model
        }, f)
        
    # 4. Generate & Train the Irrigation Technique Suggestion Classifier
    # Generate synthetic training samples representing diverse situations
    np.random.seed(42)
    num_samples = 2000
    
    synth_recharge = np.random.uniform(0.2, 3.5, num_samples)
    synth_extraction = synth_recharge * np.random.uniform(0.3, 1.5, num_samples)
    synth_soil_texture = np.random.randint(0, 3, num_samples) # 0: Coarse, 1: Medium, 2: Fine
    synth_crop_req = np.random.randint(0, 3, num_samples)     # 0: Low, 1: Medium, 2: High
    synth_rainfall = np.random.uniform(200, 1200, num_samples)
    
    # Classify category and determine label using deterministic rules scoring
    labels = []
    for i in range(num_samples):
        recharge = synth_recharge[i]
        ext = synth_extraction[i]
        soil = synth_soil_texture[i]
        crop = synth_crop_req[i]
        rain = synth_rainfall[i]
        
        stage = (ext / recharge) * 100 if recharge > 0 else 100
        category = 'Safe'
        if stage >= 100: category = 'Over Exploited'
        elif stage >= 90: category = 'Critical'
        elif stage >= 70: category = 'Semi Critical'
        
        if category == 'Safe':
            # Safe category typically keeps current practice (e.g. Flood or whatever is present)
            # We recommend Flood or Sprinkler based on soil
            best_method = 'Flood' if soil == 1 else 'Sprinkler'
        else:
            # Under high extraction stress: Drip vs Sprinkler
            # Drip is best for high water savings, fine/medium soil, deficient rainfall
            # Sprinkler is better for coarse soil, moderate savings
            drip_score = 40 + (30 if soil in [1, 2] else 0) + (10 if rain < 600 else 5)
            sprinkler_score = 30 + (30 if soil == 0 else 15) + (5 if rain >= 600 else 2)
            
            if drip_score > sprinkler_score and crop in [1, 2]:
                best_method = 'Drip'
            else:
                best_method = 'Sprinkler'
                
        labels.append(best_method)
        
    df_synth = pd.DataFrame({
        'recharge_bcm': synth_recharge,
        'extraction_bcm': synth_extraction,
        'soil_texture': synth_soil_texture,
        'crop_requirement': synth_crop_req,
        'annual_rainfall': synth_rainfall,
        'recommended_practice': labels
    })
    
    X_cls = df_synth[['recharge_bcm', 'extraction_bcm', 'soil_texture', 'crop_requirement', 'annual_rainfall']]
    y_cls = df_synth['recommended_practice']
    
    technique_classifier = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    technique_classifier.fit(X_cls, y_cls)
    
    with open('Model/technique_model.pkl', 'wb') as f:
        pickle.dump(technique_classifier, f)
        
    print("Models trained and pickles saved successfully!")
    
    # 5. Run predictions for 2025-2026 and 2026-2027
    # For 2025-2026: we use 2025 features
    df_2025 = df_features[df_features['Year'] == 2025]
    
    # For 2026-2027: we use Climatology average of 2018-2025 as prediction features
    df_clim = df_features.groupby('Norm_District')[['Annual_Rainfall', 'Average_Soil_Moisture']].mean().reset_index()
    df_clim['District_ID'] = df_clim['Norm_District'].str.lower().map(district_name_to_id)
    df_clim = df_clim.dropna(subset=['District_ID'])
    
    predictions = []
    
    # Generate predicted years:
    years_to_predict = [
        {'label': '2025-2026', 'features_df': df_2025},
        {'label': '2026-2027', 'features_df': df_clim}
    ]
    
    for yp in years_to_predict:
        year_label = yp['label']
        feat_df = yp['features_df']
        
        # 1. District predictions
        for index, row in feat_df.iterrows():
            dist_id = int(row['District_ID'])
            rainfall = float(row['Annual_Rainfall'])
            soil_moist = float(row['Average_Soil_Moisture'])
            
            # Predict
            pred_in = pd.DataFrame([[dist_id, rainfall, soil_moist]], columns=['district_id', 'annual_rainfall', 'average_soil_moisture'])
            pred_recharge = float(recharge_model.predict(pred_in)[0])
            pred_extraction = float(extraction_model.predict(pred_in)[0])
            
            # Extractable resources is typically slightly less than total recharge
            extractable = pred_recharge * 0.91
            stage = (pred_extraction / extractable) * 100 if extractable > 0 else 0
            
            # Category
            category = 'Safe'
            if stage >= 100: category = 'Over Exploited'
            elif stage >= 90: category = 'Critical'
            elif stage >= 70: category = 'Semi Critical'
            
            # Estimate DTW based on predicted stage
            dtw = 4.8
            if category == 'Semi Critical': dtw = 10.5
            elif category == 'Critical': dtw = 16.8
            elif category == 'Over Exploited': dtw = 26.5
            
            predictions.append({
                'scope': 'district',
                'district_id': dist_id,
                'assessment_year': year_label,
                'is_predicted': True,
                'recharge_bcm': float(pred_recharge),
                'extraction_all_uses_bcm': float(pred_extraction),
                'extractable_resources_bcm': float(extractable),
                'natural_discharges_bcm': float(pred_recharge * 0.09),
                'rainfall_mm': float(rainfall),
                'category': category,
                'dtw_m_bgl': float(dtw)
            })
            
            # 2. Village predictions for villages belonging to this district
            for v in villages_list:
                if v['district_id'] == dist_id:
                    # Scale down BCM metrics for the village level (approx 1/120th fraction)
                    scale_fraction = 0.008 + (v['village_id'] % 5) * 0.001
                    v_recharge = pred_recharge * scale_fraction
                    v_extraction = pred_extraction * scale_fraction
                    v_extractable = extractable * scale_fraction
                    
                    predictions.append({
                        'scope': 'village',
                        'village_id': v['village_id'],
                        'assessment_year': year_label,
                        'is_predicted': True,
                        'recharge_bcm': float(v_recharge),
                        'extraction_all_uses_bcm': float(v_extraction),
                        'extractable_resources_bcm': float(v_extractable),
                        'natural_discharges_bcm': float(v_recharge * 0.085),
                        'rainfall_mm': float(rainfall),
                        'category': category,
                        'dtw_m_bgl': float(dtw)
                    })
                    
    # Save predictions as JSON payload for Node.js
    with open('Model/predicted_assessments.json', 'w', encoding='utf-8') as f:
        json.dump(predictions, f, indent=2)
        
    print(f"SUCCESS! Saved {len(predictions)} predicted records to Model/predicted_assessments.json")

if __name__ == '__main__':
    main()
