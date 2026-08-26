-- Migration: 006_create_audits.sql
-- Description: Create audits table for seasonal verification by auditors

CREATE TABLE IF NOT EXISTS audits (
    audit_id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL REFERENCES farm_crop_records(record_id) ON DELETE CASCADE,
    auditor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actual_irrigation_method_id INTEGER REFERENCES irrigation_methods(method_id) ON DELETE SET NULL,
    adoption_status TEXT NOT NULL CHECK (adoption_status IN ('PENDING', 'ADOPTED', 'NOT_ADOPTED')),
    audit_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
