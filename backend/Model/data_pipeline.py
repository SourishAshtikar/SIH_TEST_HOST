import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import OrdinalEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb
import pickle

class GroundwaterDataPreprocessor(BaseEstimator, TransformerMixin):
    """
    Custom Scikit-Learn Transformer for Groundwater Datasets.
    
    Transforms raw input DataFrames into clean, model-ready feature matrices:
    1. Extracts temporal features: Year, Month with dayfirst=True
    2. Encodes cyclical seasonality: Sin_Month, Cos_Month
    3. Handles Station-level groundwater temporal lags dynamically (Last_GWL)
    4. Encodes categorical variables (District, Tehsil, Block, Station)
    """
    def __init__(self, cat_cols=None, num_cols=None, target_col='Groundwater Level Quarterly Manual (meter)'):
        self.cat_cols = cat_cols if cat_cols else ['District', 'Tehsil', 'Block', 'Station']
        self.num_cols = num_cols if num_cols else ['Latitude', 'Longitude', 'Year', 'Sin_Month', 'Cos_Month', 'Last_GWL']
        self.target_col = target_col
        self.features = self.cat_cols + self.num_cols
        self.encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
        self.station_history_lookup = {}
        self.global_median_gwl = 5.0

    def fit(self, X, y=None):
        X_df = X.copy()
        
        # 1. Learn categorical encoding
        self.encoder.fit(X_df[self.cat_cols].astype(str))
        
        # 2. Store station historical lookup strictly from training data
        if y is not None:
            X_df[self.target_col] = y
        
        if self.target_col in X_df.columns:
            valid_df = X_df.dropna(subset=[self.target_col])
            if 'Data Acquisition Time' in valid_df.columns:
                valid_df['Parsed_Date'] = pd.to_datetime(valid_df['Data Acquisition Time'], errors='coerce', dayfirst=True)
                valid_df = valid_df.sort_values(by=['Station', 'Parsed_Date'])
            
            # Map station to its last observed value in the training set
            self.station_history_lookup = valid_df.groupby('Station')[self.target_col].last().to_dict()
            self.global_median_gwl = float(valid_df[self.target_col].median())
        else:
            self.global_median_gwl = 5.0
            
        return self

    def transform(self, X):
        X_df = X.copy()
        
        # 1. Temporal & Cyclical Decomposition
        if 'Data Acquisition Time' in X_df.columns:
            dates = pd.to_datetime(X_df['Data Acquisition Time'], errors='coerce', dayfirst=True)
            X_df['Year'] = dates.dt.year.fillna(2021).astype(int)
            X_df['Month'] = dates.dt.month.fillna(1).astype(int)
        else:
            if 'Year' not in X_df.columns:
                X_df['Year'] = 2021
            if 'Month' not in X_df.columns:
                X_df['Month'] = 1

        X_df['Sin_Month'] = np.sin(2 * np.pi * X_df['Month'] / 12)
        X_df['Cos_Month'] = np.cos(2 * np.pi * X_df['Month'] / 12)
        
        # 2. Dynamic Lag Feature (Last_GWL)
        if 'Last_GWL' not in X_df.columns or X_df['Last_GWL'].isnull().any():
            # If target column exists in input (e.g. historical batch test set), compute chronological lag
            if self.target_col in X_df.columns and 'Station' in X_df.columns:
                if 'Data Acquisition Time' in X_df.columns:
                    X_df['Parsed_Date'] = pd.to_datetime(X_df['Data Acquisition Time'], errors='coerce', dayfirst=True)
                    X_df = X_df.sort_values(by=['Station', 'Parsed_Date'])
                
                computed_lags = X_df.groupby('Station')[self.target_col].shift(1)
                # For the first observation of a station, fallback to historical training lookup
                fallback_lags = X_df['Station'].map(self.station_history_lookup).fillna(self.global_median_gwl)
                computed_lags = computed_lags.fillna(fallback_lags)
                
                if 'Last_GWL' in X_df.columns:
                    X_df['Last_GWL'] = X_df['Last_GWL'].fillna(computed_lags)
                else:
                    X_df['Last_GWL'] = computed_lags
            elif 'Station' in X_df.columns:
                # Single sample or unlabelled inference: map to latest known station history
                mapped_lags = X_df['Station'].map(self.station_history_lookup).fillna(self.global_median_gwl)
                if 'Last_GWL' in X_df.columns:
                    X_df['Last_GWL'] = X_df['Last_GWL'].fillna(mapped_lags)
                else:
                    X_df['Last_GWL'] = mapped_lags
            else:
                X_df['Last_GWL'] = self.global_median_gwl
                
        # 3. Categorical Encoding
        X_df[self.cat_cols] = self.encoder.transform(X_df[self.cat_cols].astype(str))
        
        # 4. Return feature matrix
        return X_df[self.features].values

    def get_feature_names_out(self, input_features=None):
        return np.array(self.features)


def build_groundwater_pipeline(model_params=None):
    """
    Constructs a unified, end-to-end Scikit-Learn Pipeline combining
    the custom Data Preprocessor and the tuned XGBoost Regressor.
    """
    if model_params is None:
        model_params = {
            'n_estimators': 150,
            'max_depth': 7,
            'learning_rate': 0.04,
            'subsample': 0.8,
            'colsample_bytree': 0.85,
            'reg_alpha': 0.1,
            'reg_lambda': 1.5,
            'random_state': 42,
            'n_jobs': -1,
            'objective': 'reg:squarederror'
        }
        
    pipeline = Pipeline([
        ('preprocessor', GroundwaterDataPreprocessor()),
        ('model', xgb.XGBRegressor(**model_params))
    ])
    return pipeline


if __name__ == '__main__':
    parquet_path = r"d:\Projects\SIH 26\Groundwater Dataset\gwl_manual_quarterly_cgwb_hr_1991_2020.parquet"
    print(f"Loading raw data: {parquet_path}")
    raw_df = pd.read_parquet(parquet_path)
    target_col = 'Groundwater Level Quarterly Manual (meter)'
    
    # Clean raw dataset & sort chronologically per station
    df_clean = raw_df.dropna(subset=[target_col]).copy()
    df_clean['Data Acquisition Time'] = pd.to_datetime(df_clean['Data Acquisition Time'], errors='coerce', dayfirst=True)
    df_clean = df_clean.sort_values(by=['Station', 'Data Acquisition Time']).reset_index(drop=True)
    
    # Calculate Lag for training
    df_clean['Last_GWL'] = df_clean.groupby('Station')[target_col].shift(1)
    df_clean = df_clean.dropna(subset=['Last_GWL']).reset_index(drop=True)
    
    # Strict Temporal Split: Train <= 2017, Test > 2017
    train_mask = df_clean['Data Acquisition Time'].dt.year <= 2017
    df_train = df_clean[train_mask].copy()
    df_test = df_clean[~train_mask].copy()
    
    print(f"Temporal Split -> Train (<=2017): {len(df_train):,} samples, Test (>2017): {len(df_test):,} samples")
    
    X_train = df_train.drop(columns=[target_col])
    y_train = df_train[target_col]
    X_test = df_test.drop(columns=[target_col])
    y_test = df_test[target_col]
    
    # Baseline: Naive Persistence (Last_GWL as prediction)
    baseline_preds = df_test['Last_GWL']
    b_r2 = r2_score(y_test, baseline_preds)
    b_mae = mean_absolute_error(y_test, baseline_preds)
    b_rmse = np.sqrt(mean_squared_error(y_test, baseline_preds))
    print(f"\n--- Naive Persistence Baseline (y_hat = Last_GWL) ---")
    print(f"Baseline R²:   {b_r2:.4f}")
    print(f"Baseline MAE:  {b_mae:.4f} m")
    print(f"Baseline RMSE: {b_rmse:.4f} m")
    
    # Initialize and fit end-to-end pipeline
    print("\nFitting unified pipeline (Preprocessor + XGBoost)...")
    pipeline = build_groundwater_pipeline()
    pipeline.fit(X_train, y_train)
    
    # Evaluate pipeline on unseen future test quarters
    y_pred = pipeline.predict(X_test)
    r2 = r2_score(y_test, y_pred)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    
    print(f"\n========== MODEL PERFORMANCE (Temporal Test) ==========")
    print(f"R² Score:                       {r2:.4f}")
    print(f"Mean Absolute Error (MAE):      {mae:.4f} meters")
    print(f"Root Mean Squared Error (RMSE): {rmse:.4f} meters")
    print(f"MAE Improvement over Baseline:  {((b_mae - mae) / b_mae)*100:.2f}%")
    print(f"=======================================================")
    
    # Save the pipeline
    save_path = r"d:\Projects\SIH 26\Groundwater Dataset\unified_groundwater_pipeline.pkl"
    with open(save_path, 'wb') as f:
        pickle.dump(pipeline, f)
    print(f"\nPipeline saved to: {save_path}")
    
    # Test on test.csv if available
    test_csv_path = r"d:\Projects\SIH 26\Groundwater Dataset\test.csv"
    if pd.io.common.file_exists(test_csv_path):
        test_df = pd.read_csv(test_csv_path)
        test_preds = pipeline.predict(test_df)
        print(f"\n========== SAMPLE PREDICTIONS ON test.csv (First 10) ==========")
        print(np.round(test_preds[:10], 4))

