import os
import sys
import numpy as np
import pandas as pd
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from Model.train_enhanced_model import EnhancedGroundwaterPreprocessor, build_enhanced_pipeline

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path_1991_2020 = os.path.join(base_dir, "Dataset", "gwl_manual_quarterly_cgwb_hr_1991_2020.csv")
path_2021_2024 = os.path.join(base_dir, "Dataset", "2021-2024_groundwater_dataset.csv")

print("1. Loading 1991-2020 training dataset...")
df_train = pd.read_csv(path_1991_2020)
target_col = 'Groundwater Level Quarterly Manual (meter)'

df_train_clean = df_train.dropna(subset=[target_col]).copy()
df_train_clean['Data Acquisition Time'] = pd.to_datetime(df_train_clean['Data Acquisition Time'], errors='coerce', dayfirst=True)
df_train_clean = df_train_clean.sort_values(by=['District', 'Tehsil', 'Block', 'Station', 'Data Acquisition Time']).reset_index(drop=True)
df_train_clean['Last_GWL'] = df_train_clean.groupby(['District', 'Tehsil', 'Block', 'Station'])[target_col].shift(1)
df_train_clean['Last_GWL'] = df_train_clean['Last_GWL'].fillna(df_train_clean.groupby('District')[target_col].transform('median'))

X_train = df_train_clean.drop(columns=[target_col])
y_train = df_train_clean[target_col]

print(f"2. Fitting model pipeline on {len(X_train)} historical records (1991-2020)...")
pipeline = build_enhanced_pipeline()
pipeline.fit(X_train, y_train)

print("3. Loading entire 2021-2024 evaluation dataset...")
df_eval = pd.read_csv(path_2021_2024)
df_eval_clean = df_eval.dropna(subset=[target_col]).copy()

df_eval_clean['Data Acquisition Time'] = pd.to_datetime(df_eval_clean['Data Acquisition Time'], errors='coerce', dayfirst=True)
df_eval_clean = df_eval_clean.sort_values(by=['District', 'Tehsil', 'Block', 'Station', 'Data Acquisition Time']).reset_index(drop=True)

X_eval = df_eval_clean.drop(columns=[target_col])
y_actual = df_eval_clean[target_col].values

print(f"4. Running ML model prediction across all {len(X_eval)} actual field records in 2021-2024 dataset...")
y_pred = pipeline.predict(X_eval)

r2 = r2_score(y_actual, y_pred)
mae = mean_absolute_error(y_actual, y_pred)
rmse = np.sqrt(mean_squared_error(y_actual, y_pred))

abs_errors = np.abs(y_actual - y_pred)
within_1m = (abs_errors <= 1.0).mean() * 100
within_2m = (abs_errors <= 2.0).mean() * 100
within_3m = (abs_errors <= 3.0).mean() * 100

print("\n=============================================================")
print("=== 2021-2024 FULL DATASET ML MODEL EVALUATION RESULTS ===")
print("=============================================================")
print(f"Total Test Records Analyzed : {len(y_actual)}")
print(f"R² Score (Accuracy)         : {r2:.4f} ({r2*100:.2f}%)")
print(f"Mean Absolute Error (MAE)   : {mae:.2f} meters")
print(f"Root Mean Sq. Error (RMSE)  : {rmse:.2f} meters")
print(f"Accuracy within ± 1.0 meter : {within_1m:.2f}%")
print(f"Accuracy within ± 2.0 meters: {within_2m:.2f}%")
print(f"Accuracy within ± 3.0 meters: {within_3m:.2f}%")
print("=============================================================\n")

# Save evaluation comparisons CSV
results_df = df_eval_clean[['District', 'Tehsil', 'Block', 'Station', 'Latitude', 'Longitude', 'Data Acquisition Time']].copy()
results_df['Actual_GWL_Meters'] = y_actual
results_df['Predicted_GWL_Meters'] = np.round(y_pred, 2)
results_df['Absolute_Error_Meters'] = np.round(abs_errors, 2)

out_csv = os.path.join(base_dir, "scratch", "2021_2024_predictions_vs_actual.csv")
results_df.to_csv(out_csv, index=False)
print(f"Saved complete prediction comparison table to: {out_csv}")
