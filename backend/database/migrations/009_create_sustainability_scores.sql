-- Migration: 009_create_sustainability_scores.sql
-- Description: Create sustainability_scores table for persisting seasonal farm sustainability scores and derived priorities

CREATE TABLE IF NOT EXISTS sustainability_scores (
    score_id SERIAL PRIMARY KEY,
    farm_id INTEGER NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    season_id INTEGER NOT NULL REFERENCES seasons(season_id) ON DELETE RESTRICT,
    agricultural_year TEXT NOT NULL,
    adoption_score REAL NOT NULL DEFAULT 0 CHECK (adoption_score >= 0 AND adoption_score <= 50),
    continued_adoption_score REAL NOT NULL DEFAULT 0 CHECK (continued_adoption_score >= 0 AND continued_adoption_score <= 30),
    audit_score REAL NOT NULL DEFAULT 0 CHECK (audit_score >= 0 AND audit_score <= 20),
    compliance_score REAL NOT NULL DEFAULT 0,
    sustainability_score REAL NOT NULL CHECK (sustainability_score >= 0 AND sustainability_score <= 100),
    priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (farm_id, season_id, agricultural_year)
);
