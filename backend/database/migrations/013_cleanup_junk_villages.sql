-- Migration 013: Remove duplicate/junk placeholder villages created by scratch scripts
-- The real CGWB station-based villages (village_id 1-87) already have correct lat/lng.
-- Junk villages (Score Village, Normalized Vil, Definitive Vil) are cleaned up at runtime via seed script.
-- This migration documents the cleanup for record.

-- NOTE: Actual cleanup was performed directly via Node.js seed script (scratch/cleanup_junk_villages.js)
-- on 2026-08-24. No SQL needed here as data was already cleaned.

-- Verify cleanup (informational):
-- SELECT name FROM villages WHERE name ILIKE '%Score Village%' OR name ILIKE '%Normalized Vil%' OR name ILIKE '%Definitive Vil%';
-- Expected: 0 rows
