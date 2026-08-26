-- Migration: 014_enhance_crops_and_irrigation_methods.sql
-- Description: Expand crops and irrigation_methods tables to support comprehensive agricultural metadata, bilingual names, and efficiency scores.

-- 1. Alter crops table
ALTER TABLE crops DROP CONSTRAINT IF EXISTS crops_water_requirement_check;

ALTER TABLE crops 
  ADD COLUMN IF NOT EXISTS season TEXT,
  ADD COLUMN IF NOT EXISTS water_requirement_class TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS suitable_practices JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS water_saving_practices JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS critical_irrigation_stages JSONB DEFAULT '[]'::jsonb;

-- 2. Alter irrigation_methods table
ALTER TABLE irrigation_methods 
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS water_efficiency TEXT,
  ADD COLUMN IF NOT EXISTS water_savings_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS energy_savings_percentage NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Create unique index on code if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_irrigation_methods_code ON irrigation_methods(code) WHERE code IS NOT NULL;
