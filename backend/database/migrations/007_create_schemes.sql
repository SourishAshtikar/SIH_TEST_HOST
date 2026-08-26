-- Migration: 007_create_schemes.sql
-- Description: Create schemes table for informational government scheme catalog

CREATE TABLE IF NOT EXISTS schemes (
    scheme_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    government_level VARCHAR(50) DEFAULT 'STATE',
    benefit_description TEXT,
    eligibility TEXT,
    application_information TEXT,
    external_link TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
