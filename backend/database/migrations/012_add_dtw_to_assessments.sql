-- Migration: 012_add_dtw_to_assessments.sql
-- Description: Add dtw_m_bgl column for actual groundwater depth-to-water level measurements.

ALTER TABLE groundwater_assessments ADD COLUMN IF NOT EXISTS dtw_m_bgl REAL;
