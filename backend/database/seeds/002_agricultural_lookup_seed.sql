-- Seed: 002_agricultural_lookup_seed.sql
-- Description: Initial agricultural lookup seed data for seasons, crops, and irrigation methods

-- 1. Seasons
INSERT INTO seasons (season_id, name)
VALUES 
    (1, 'Kharif'),
    (2, 'Rabi'),
    (3, 'Zaid')
ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name;

-- 2. Crops
INSERT INTO crops (crop_id, name, water_requirement)
VALUES 
    (1, 'Rice', 'High'),
    (2, 'Wheat', 'Medium'),
    (3, 'Millet', 'Low')
ON CONFLICT (name) DO UPDATE SET water_requirement = EXCLUDED.water_requirement;

-- 3. Irrigation Methods
INSERT INTO irrigation_methods (method_id, name)
VALUES 
    (1, 'Flood Irrigation'),
    (2, 'Drip Irrigation'),
    (3, 'Sprinkler Irrigation')
ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name;

-- Adjust sequence values to prevent collision on future inserts
SELECT setval(pg_get_serial_sequence('seasons', 'season_id'), COALESCE(MAX(season_id), 1)) FROM seasons;
SELECT setval(pg_get_serial_sequence('crops', 'crop_id'), COALESCE(MAX(crop_id), 1)) FROM crops;
SELECT setval(pg_get_serial_sequence('irrigation_methods', 'method_id'), COALESCE(MAX(method_id), 1)) FROM irrigation_methods;
