import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import pickle
import pandas as pd
from scratch.train_model_clean import EnhancedGroundwaterPreprocessor

model_path = os.path.join("Model", "enhanced_groundwater_pipeline.pkl")
with open(model_path, "rb") as f:
    pipeline = pickle.load(f)

test_cases = [
    {
        "District": "Panchkula",
        "Tehsil": "Kalka",
        "Block": "Pinjore",
        "Station": "Abdullapur",
        "Latitude": 30.7947,
        "Longitude": 76.9164,
        "Year": 2023,
        "Month": 6
    },
    {
        "District": "Faridabad",
        "Tehsil": "Ballabgarh",
        "Block": "BALLABGARH",
        "Station": "Ballabhgarh",
        "Latitude": 28.33,
        "Longitude": 77.31,
        "Year": 2023,
        "Month": 6
    },
    {
        "District": "Karnal",
        "Tehsil": "Gharaunda",
        "Block": "Gharaunda",
        "Station": "Gharaunda",
        "Latitude": 29.54,
        "Longitude": 76.97,
        "Year": 2023,
        "Month": 6
    },
    {
        "District": "Kurukshetra",
        "Tehsil": "Pehowa",
        "Block": "Pehowa",
        "Station": "Pehowa",
        "Latitude": 29.98,
        "Longitude": 76.58,
        "Year": 2023,
        "Month": 6
    }
]

df_test = pd.DataFrame(test_cases)
preds = pipeline.predict(df_test)

for tc, pred in zip(test_cases, preds):
    print(f"Station: {tc['Station']} ({tc['District']}) -> Predicted GWL: {pred:.2f} meters")
