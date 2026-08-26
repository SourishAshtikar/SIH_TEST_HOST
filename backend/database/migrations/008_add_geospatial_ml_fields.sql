-- Migration: 008_add_geospatial_ml_fields.sql
-- Description: Add geospatial and administrative ML parameters (tehsil, block, station, latitude, longitude, lgd_code) to villages and farms tables

-- 1. Extend villages table with ML parameters
ALTER TABLE villages 
    ADD COLUMN IF NOT EXISTS lgd_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tehsil TEXT,
    ADD COLUMN IF NOT EXISTS block TEXT,
    ADD COLUMN IF NOT EXISTS station_name TEXT,
    ADD COLUMN IF NOT EXISTS latitude REAL,
    ADD COLUMN IF NOT EXISTS longitude REAL;

-- 2. Extend farms table with optional specific farm-level coordinates
ALTER TABLE farms
    ADD COLUMN IF NOT EXISTS latitude REAL,
    ADD COLUMN IF NOT EXISTS longitude REAL;
