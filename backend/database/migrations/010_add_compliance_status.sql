-- Migration: 010_add_compliance_status.sql
-- Description: Add explicit seasonal compliance status to farm crop records and audits

ALTER TABLE farm_crop_records 
ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'PENDING' 
CHECK (compliance_status IN ('COMPLIANT', 'NOT_COMPLIANT', 'NOT_APPLICABLE', 'PENDING'));

ALTER TABLE audits 
ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT NULL 
CHECK (compliance_status IS NULL OR compliance_status IN ('COMPLIANT', 'NOT_COMPLIANT', 'NOT_APPLICABLE', 'PENDING'));
