-- Migration: 004_create_agricultural_lookups.sql
-- Description: Create seasons, crops, and irrigation_methods lookup tables

CREATE TABLE IF NOT EXISTS seasons (
    season_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS crops (
    crop_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    water_requirement TEXT CHECK (water_requirement IN ('Low', 'Medium', 'High'))
);

CREATE TABLE IF NOT EXISTS irrigation_methods (
    method_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
