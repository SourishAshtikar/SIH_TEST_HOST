-- Migration: 011_create_groundwater_assessments.sql
-- Description: Create table for storing historical and predicted groundwater assessment metrics for districts and villages.

CREATE TABLE IF NOT EXISTS groundwater_assessments (
    assessment_id SERIAL PRIMARY KEY,
    district_id INTEGER REFERENCES districts(district_id) ON DELETE CASCADE,
    village_id INTEGER REFERENCES villages(village_id) ON DELETE CASCADE,
    assessment_year TEXT NOT NULL,
    is_predicted BOOLEAN NOT NULL DEFAULT FALSE,
    extractable_resources_bcm REAL,
    extraction_all_uses_bcm REAL,
    rainfall_mm REAL,
    recharge_bcm REAL,
    natural_discharges_bcm REAL,
    category TEXT CHECK (category IN ('Safe', 'Semi Critical', 'Critical', 'Over Exploited', 'Hilly Area', 'No Data')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_district_or_village CHECK (
        (district_id IS NOT NULL AND village_id IS NULL) OR
        (district_id IS NULL AND village_id IS NOT NULL)
    )
);

-- Index for district-level assessments
CREATE UNIQUE INDEX IF NOT EXISTS idx_gw_assess_district 
ON groundwater_assessments (district_id, assessment_year, is_predicted) 
WHERE village_id IS NULL;

-- Index for village-level assessments
CREATE UNIQUE INDEX IF NOT EXISTS idx_gw_assess_village 
ON groundwater_assessments (village_id, assessment_year, is_predicted) 
WHERE district_id IS NULL;
