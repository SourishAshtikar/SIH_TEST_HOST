-- Migration: 005_create_farm_crop_records.sql
-- Description: Create farm_crop_records table to track seasonal agricultural crop data

CREATE TABLE IF NOT EXISTS farm_crop_records (
    record_id SERIAL PRIMARY KEY,
    farm_id INTEGER NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    season_id INTEGER NOT NULL REFERENCES seasons(season_id) ON DELETE RESTRICT,
    agricultural_year TEXT NOT NULL,
    crop_id INTEGER NOT NULL REFERENCES crops(crop_id) ON DELETE RESTRICT,
    cultivated_area_hectares REAL,
    current_irrigation_method_id INTEGER REFERENCES irrigation_methods(method_id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (farm_id, season_id, agricultural_year, crop_id)
);
