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

class EnhancedGroundwaterPreprocessor(BaseEstimator, TransformerMixin):
    def __init__(self, cat_cols=None, num_cols=None, target_col='Groundwater Level Quarterly Manual (meter)'):
        self.cat_cols = cat_cols if cat_cols else ['District', 'Tehsil', 'Block', 'Station']
        self.num_cols = num_cols if num_cols else ['Latitude', 'Longitude', 'Year', 'Sin_Month', 'Cos_Month', 'Last_GWL', 'Elevation', 'API_Rainfall', 'Soil_Moisture']
        self.target_col = target_col
        self.features = self.cat_cols + self.num_cols
        self.encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
        self.station_history_lookup = {}
        self.district_history_lookup = {}
        self.global_median_gwl = 12.0
        self.rain_climatology = {}
        self.sm_climatology = {}

    def fit(self, X, y=None):
        X_df = X.copy()
        self.encoder.fit(X_df[self.cat_cols].astype(str))
        
        if y is not None:
            X_df[self.target_col] = y
        
        if self.target_col in X_df.columns:
            valid_df = X_df.dropna(subset=[self.target_col]).copy()
            if 'Data Acquisition Time' in valid_df.columns:
                valid_df['Parsed_Date'] = pd.to_datetime(valid_df['Data Acquisition Time'], errors='coerce', dayfirst=True)
                valid_df = valid_df.sort_values(by=['Station', 'Parsed_Date'])
            
            # Case-insensitive station lookup
            for st, grp in valid_df.groupby('Station'):
                last_val = grp[self.target_col].iloc[-1]
                if pd.notnull(last_val):
                    self.station_history_lookup[str(st).strip().lower()] = float(last_val)

            # District lookup fallback
            for dist, grp in valid_df.groupby('District'):
                med_val = grp[self.target_col].median()
                if pd.notnull(med_val):
                    self.district_history_lookup[str(dist).strip().lower()] = float(med_val)

            self.global_median_gwl = float(valid_df[self.target_col].median())
        else:
            self.global_median_gwl = 12.0
            
        return self

    def transform(self, X):
        X_df = X.copy()
        
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
        
        # Last_GWL fallback logic
        if 'Last_GWL' not in X_df.columns or X_df['Last_GWL'].isnull().any():
            last_gwl_vals = []
            for _, row in X_df.iterrows():
                if pd.notnull(row.get('Last_GWL')):
                    last_gwl_vals.append(float(row['Last_GWL']))
                    continue
                st_key = str(row.get('Station', '')).strip().lower()
                dist_key = str(row.get('District', '')).strip().lower()
                
                if st_key in self.station_history_lookup:
                    last_gwl_vals.append(self.station_history_lookup[st_key])
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

        X_df[self.cat_cols] = self.encoder.transform(X_df[self.cat_cols].astype(str))
        
        return X_df[self.features].values

def train_and_save():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, "Dataset", "gwl_manual_quarterly_cgwb_hr_1991_2020.csv")
    
    print(f"Loading training data from {dataset_path}...")
    df_raw = pd.read_csv(dataset_path)
    
    target_col = 'Groundwater Level Quarterly Manual (meter)'
    df_clean = df_raw.dropna(subset=[target_col]).copy()
    
    df_clean['Data Acquisition Time'] = pd.to_datetime(df_clean['Data Acquisition Time'], errors='coerce', dayfirst=True)
    df_clean = df_clean.sort_values(by=['Station', 'Data Acquisition Time']).reset_index(drop=True)
    df_clean['Last_GWL'] = df_clean.groupby('Station')[target_col].shift(1)
    df_clean['Last_GWL'] = df_clean['Last_GWL'].fillna(df_clean.groupby('District')[target_col].transform('median'))
    
    X = df_clean.drop(columns=[target_col])
    y = df_clean[target_col]
    
    print(f"Training XGBoost regressor model on {len(X)} records across Haryana...")
    
    preprocessor = EnhancedGroundwaterPreprocessor()
    preprocessor.fit(X, y)
    X_transformed = preprocessor.transform(X)
    
    model_params = {
        'n_estimators': 400,
        'max_depth': 7,
        'learning_rate': 0.04,
        'subsample': 0.85,
        'colsample_bytree': 0.85,
        'random_state': 42,
        'n_jobs': -1,
        'objective': 'reg:squarederror'
    }
    
    model = xgb.XGBRegressor(**model_params)
    model.fit(X_transformed, y)
    
    pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('model', model)
    ])
    
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

if __name__ == '__main__':
    train_and_save()
