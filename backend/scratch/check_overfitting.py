import os
import sys
import numpy as np
import pandas as pd
from sklearn.model_selection import KFold, train_test_split
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
import xgboost as xgb

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from Model.train_enhanced_model import EnhancedGroundwaterPreprocessor, build_enhanced_pipeline

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path_1991_2020 = os.path.join(base_dir, "Dataset", "gwl_manual_quarterly_cgwb_hr_1991_2020.csv")
path_2021_2024 = os.path.join(base_dir, "Dataset", "2021-2024_groundwater_dataset.csv")

df_1 = pd.read_csv(path_1991_2020)
df_2 = pd.read_csv(path_2021_2024)
target_col = 'Groundwater Level Quarterly Manual (meter)'

common_cols = [c for c in df_1.columns if c in df_2.columns]
df_raw = pd.concat([df_1[common_cols], df_2[common_cols]], ignore_index=True)
df_clean = df_raw.dropna(subset=[target_col]).copy()

# Filter outliers
meds = df_clean.groupby(['District', 'Station'])[target_col].transform('median')
is_outlier = (df_clean[target_col] > 2.2 * meds) & (meds < 6.0) & (df_clean[target_col] > 10.0)
df_clean = df_clean[~is_outlier].copy()

df_clean['Data Acquisition Time'] = pd.to_datetime(df_clean['Data Acquisition Time'], errors='coerce', dayfirst=True)
df_clean = df_clean.sort_values(by=['District', 'Tehsil', 'Block', 'Station', 'Data Acquisition Time']).reset_index(drop=True)
df_clean['Last_GWL'] = df_clean.groupby(['District', 'Tehsil', 'Block', 'Station'])[target_col].shift(1)
df_clean['Last_GWL'] = df_clean['Last_GWL'].fillna(df_clean.groupby('District')[target_col].transform('median'))

X = df_clean.drop(columns=[target_col])
y = df_clean[target_col]

print("--- EVALUATION 1: CHRONOLOGICAL OUT-OF-SAMPLE SPLIT (Train <= 2020, Test 2021-2024) ---")
train_mask = X['Data Acquisition Time'].dt.year <= 2020
test_mask = X['Data Acquisition Time'].dt.year > 2020

X_train_c, y_train_c = X[train_mask], y[train_mask]
X_test_c, y_test_c = X[test_mask], y[test_mask]

pipe_c = build_enhanced_pipeline()
pipe_c.fit(X_train_c, y_train_c)

train_preds_c = pipe_c.predict(X_train_c)
test_preds_c = pipe_c.predict(X_test_c)

print(f"Train R²: {r2_score(y_train_c, train_preds_c):.4f} | Train MAE: {mean_absolute_error(y_train_c, train_preds_c):.2f} m")
print(f"TEST R² (Unseen Future 2021-2024 Data): {r2_score(y_test_c, test_preds_c):.4f} | TEST MAE: {mean_absolute_error(y_test_c, test_preds_c):.2f} m")

print("\n--- EVALUATION 2: RANDOM 80/20 TRAIN-TEST SPLIT ---")
X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)

pipe_r = build_enhanced_pipeline()
pipe_r.fit(X_tr, y_tr)

tr_preds = pipe_r.predict(X_tr)
te_preds = pipe_r.predict(X_te)

print(f"Train R²: {r2_score(y_tr, tr_preds):.4f} | Train MAE: {mean_absolute_error(y_tr, tr_preds):.2f} m")
print(f"TEST R² (Unseen 20% Holdout): {r2_score(y_te, te_preds):.4f} | TEST MAE: {mean_absolute_error(y_te, te_preds):.2f} m")
