import os
import sys
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import OrdinalEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb
import pickle

import re

def clean_station_name(val):
    if not val or pd.isnull(val):
        return ""
    s = str(val).strip().upper()
    s = re.sub(r'[\s\-_]+(PZ|DW|S|M|D|PZ\-D|PZ\-S|PZ\-M|\(S\)|\(M\)|\(D\)|\d+\(S\))$', '', s, flags=re.I)
    return s.strip()

class EnhancedGroundwaterPreprocessor(BaseEstimator, TransformerMixin):
    def __init__(self, cat_cols=None, num_cols=None, target_col='Groundwater Level Quarterly Manual (meter)'):
        self.cat_cols = cat_cols if cat_cols else ['District', 'Tehsil', 'Block', 'Station']
        self.num_cols = num_cols if num_cols else ['Latitude', 'Longitude', 'Year', 'Sin_Month', 'Cos_Month', 'Last_GWL', 'Elevation', 'API_Rainfall', 'Soil_Moisture']
        self.target_col = target_col
        self.features = self.cat_cols + self.num_cols
        self.encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
        self.station_month_lookup = {}
        self.station_max_lookup = {}
        self.district_history_lookup = {}
        self.global_median_gwl = 12.0

    def fit(self, X, y=None):
        X_df = X.copy()
        for col in self.cat_cols:
            if col in X_df.columns:
                X_df[col] = X_df[col].astype(str).str.strip().str.upper()
        if 'Station' in X_df.columns:
            X_df['Station'] = X_df['Station'].apply(clean_station_name)

        self.encoder.fit(X_df[self.cat_cols])
        
        if y is not None:
            X_df[self.target_col] = y
        
        if self.target_col in X_df.columns:
            valid_df = X_df.dropna(subset=[self.target_col]).copy()
            if 'Data Acquisition Time' in valid_df.columns:
                valid_df['Parsed_Date'] = pd.to_datetime(valid_df['Data Acquisition Time'], errors='coerce', dayfirst=True)
                valid_df['Month'] = valid_df['Parsed_Date'].dt.month.fillna(6).astype(int)
                valid_df = valid_df.sort_values(by=['District', 'Station', 'Parsed_Date'])
            else:
                if 'Month' not in valid_df.columns:
                    valid_df['Month'] = 6

            for (dist, st, m), grp in valid_df.groupby(['District', 'Station', 'Month']):
                val = grp[self.target_col].iloc[-1]
                if pd.notnull(val):
                    self.station_month_lookup[(str(dist).strip().upper(), clean_station_name(st), int(m))] = float(val)
            
            for (dist, st), grp in valid_df.groupby(['District', 'Station']):
                val = grp[self.target_col].iloc[-1]
                if pd.notnull(val):
                    self.station_max_lookup[(str(dist).strip().upper(), clean_station_name(st))] = float(val)

            for dist, grp in valid_df.groupby('District'):
                med_val = grp[self.target_col].median()
                if pd.notnull(med_val):
                    self.district_history_lookup[str(dist).strip().upper()] = float(med_val)

            self.spatial_records = valid_df.dropna(subset=['Latitude', 'Longitude', self.target_col])[['Latitude', 'Longitude', 'Month', self.target_col]].values

            self.global_median_gwl = float(valid_df[self.target_col].median())
        else:
            self.global_median_gwl = 12.0
            
        return self

    def transform(self, X):
        X_df = X.copy()
        for col in self.cat_cols:
            if col in X_df.columns:
                X_df[col] = X_df[col].astype(str).str.strip().str.upper()
        if 'Station' in X_df.columns:
            X_df['Station'] = X_df['Station'].apply(clean_station_name)
        
        if 'Data Acquisition Time' in X_df.columns:
            dates = pd.to_datetime(X_df['Data Acquisition Time'], errors='coerce', dayfirst=True)
            X_df['Year'] = dates.dt.year.fillna(2023).astype(int)
            X_df['Month'] = dates.dt.month.fillna(6).astype(int)
        else:
            if 'Year' not in X_df.columns:
                X_df['Year'] = 2023
            if 'Month' not in X_df.columns:
                X_df['Month'] = 6

        X_df['Sin_Month'] = np.sin(2 * np.pi * X_df['Month'] / 12)
        X_df['Cos_Month'] = np.cos(2 * np.pi * X_df['Month'] / 12)
        
        if 'Last_GWL' not in X_df.columns or X_df['Last_GWL'].isnull().any():
            last_gwl_vals = []
            for _, row in X_df.iterrows():
                if pd.notnull(row.get('Last_GWL')):
                    last_gwl_vals.append(float(row['Last_GWL']))
                    continue
                dist_key = str(row.get('District', '')).strip().upper()
                st_key = clean_station_name(row.get('Station', ''))
                month = int(row.get('Month', 6))
                lat = float(row.get('Latitude', 0) or 0)
                lon = float(row.get('Longitude', 0) or 0)
                
                if (dist_key, st_key, month) in self.station_month_lookup:
                    last_gwl_vals.append(self.station_month_lookup[(dist_key, st_key, month)])
                elif (dist_key, st_key) in self.station_max_lookup:
                    last_gwl_vals.append(self.station_max_lookup[(dist_key, st_key)])
                elif lat > 0 and lon > 0 and hasattr(self, 'spatial_records') and len(self.spatial_records) > 0:
                    dists = (self.spatial_records[:, 0] - lat)**2 + (self.spatial_records[:, 1] - lon)**2
                    min_idx = np.argmin(dists)
                    if dists[min_idx] < 0.05:
                        last_gwl_vals.append(float(self.spatial_records[min_idx, 3]))
                    elif dist_key in self.district_history_lookup:
                        last_gwl_vals.append(self.district_history_lookup[dist_key])
                    else:
                        last_gwl_vals.append(self.global_median_gwl)
                elif dist_key in self.district_history_lookup:
                    last_gwl_vals.append(self.district_history_lookup[dist_key])
                else:
                    last_gwl_vals.append(self.global_median_gwl)
            X_df['Last_GWL'] = last_gwl_vals
                
        if 'Elevation' not in X_df.columns:
            X_df['Elevation'] = 250.0 + (X_df['Latitude'].fillna(29.0) - 29.0) * 50
        
        if 'API_Rainfall' not in X_df.columns or X_df['API_Rainfall'].isnull().any():
            def get_rain(m):
                return 150.0 if m in [7, 8, 9] else 25.0
            X_df['API_Rainfall'] = X_df['Month'].apply(get_rain)
            
        if 'Soil_Moisture' not in X_df.columns or X_df['Soil_Moisture'].isnull().any():
            X_df['Soil_Moisture'] = 20.0

        X_df[self.cat_cols] = self.encoder.transform(X_df[self.cat_cols])
        
        return X_df[self.features].values

def build_enhanced_pipeline():
    model_params = {
        'n_estimators': 300,
        'max_depth': 5,          # Controlled depth to prevent memorization/overfitting
        'learning_rate': 0.04,
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'reg_alpha': 0.2,        # L1 Lasso regularization
        'reg_lambda': 1.5,        # L2 Ridge regularization
        'random_state': 42,
        'n_jobs': -1,
        'objective': 'reg:squarederror'
    }
    
    pipeline = Pipeline([
        ('preprocessor', EnhancedGroundwaterPreprocessor()),
        ('model', xgb.XGBRegressor(**model_params))
    ])
    return pipeline

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path_1991_2020 = os.path.join(base_dir, "Dataset", "gwl_manual_quarterly_cgwb_hr_1991_2020.csv")
    path_2021_2024 = os.path.join(base_dir, "Dataset", "2021-2024_groundwater_dataset.csv")
    
    print(f"Loading 1991-2020 training data from {path_1991_2020}...")
    df_1 = pd.read_csv(path_1991_2020)
    print(f"Loading 2021-2024 training data from {path_2021_2024}...")
    df_2 = pd.read_csv(path_2021_2024)
    
    target_col = 'Groundwater Level Quarterly Manual (meter)'
    
    common_cols = [c for c in df_1.columns if c in df_2.columns]
    df_raw = pd.concat([df_1[common_cols], df_2[common_cols]], ignore_index=True)
    df_clean = df_raw.dropna(subset=[target_col]).copy()
    
    # Filter out erroneous manual entry spikes (e.g. 12.7m spike in shallow 4.5m station)
    meds = df_clean.groupby(['District', 'Station'])[target_col].transform('median')
    is_outlier = (df_clean[target_col] > 2.2 * meds) & (meds < 6.0) & (df_clean[target_col] > 10.0)
    df_clean = df_clean[~is_outlier].copy()

    df_clean['Data Acquisition Time'] = pd.to_datetime(df_clean['Data Acquisition Time'], errors='coerce', dayfirst=True)
    df_clean = df_clean.sort_values(by=['District', 'Tehsil', 'Block', 'Station', 'Data Acquisition Time']).reset_index(drop=True)
    df_clean['Last_GWL'] = df_clean.groupby(['District', 'Tehsil', 'Block', 'Station'])[target_col].shift(1)
    df_clean['Last_GWL'] = df_clean['Last_GWL'].fillna(df_clean.groupby('District')[target_col].transform('median'))
    
    X = df_clean.drop(columns=[target_col])
    y = df_clean[target_col]
    
    print(f"Training XGBoost regressor model on all {len(X)} combined records (1991-2024) across Haryana...")
    pipeline = build_enhanced_pipeline()
    
    pipeline.named_steps['preprocessor'].fit(X, y)
    X_transformed = pipeline.named_steps['preprocessor'].transform(X)
    pipeline.named_steps['model'].fit(X_transformed, y)
    
    preds = pipeline.predict(X)
    r2 = r2_score(y, preds)
    mae = mean_absolute_error(y, preds)
    rmse = np.sqrt(mean_squared_error(y, preds))
    
    print(f"Model Training Results:")
    print(f"R² Score: {r2:.4f}")
    print(f"MAE: {mae:.2f} meters")
    print(f"RMSE: {rmse:.2f} meters")
    
    out_path = os.path.join(base_dir, "Model", "enhanced_groundwater_pipeline.pkl")
    with open(out_path, 'wb') as f:
        pickle.dump(pipeline, f)
    print(f"Saved enhanced pipeline model to: {out_path}")

