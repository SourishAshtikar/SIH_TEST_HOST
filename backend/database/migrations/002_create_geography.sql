-- Migration: 002_create_geography.sql
-- Description: Create geography hierarchy tables (states, districts, villages) and add geographic assignments to users

CREATE TABLE IF NOT EXISTS states (
    state_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS districts (
    district_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    state_id INTEGER NOT NULL REFERENCES states(state_id) ON DELETE RESTRICT,
    UNIQUE (name, state_id)
);

CREATE TABLE IF NOT EXISTS villages (
    village_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    district_id INTEGER NOT NULL REFERENCES districts(district_id) ON DELETE RESTRICT,
    UNIQUE (name, district_id)
);

-- Add geographic assignment columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS district_id INTEGER REFERENCES districts(district_id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS village_id INTEGER REFERENCES villages(village_id) ON DELETE SET NULL;
