-- Migration: 003_create_farms.sql
-- Description: Create farms table representing individual tracked farm entities

CREATE TABLE IF NOT EXISTS farms (
    farm_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    owner_name TEXT,
    village_id INTEGER NOT NULL REFERENCES villages(village_id) ON DELETE RESTRICT,
    total_land_area_hectares REAL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
