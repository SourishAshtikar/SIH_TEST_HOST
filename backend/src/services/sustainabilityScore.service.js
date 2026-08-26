const { query } = require('../db');

/**
 * Derives the intervention / sustainability priority from a 0-100 score.
 * Thresholds:
 *   76 - 100 -> HIGH
 *   51 - 75  -> MEDIUM
 *   0 - 50   -> LOW
 * 
 * Note: "HIGH" means high sustainability performance / high recognition-support priority.
 * "LOW" means low sustainability performance.
 */
function derivePriority(score) {
  if (score > 75) return 'HIGH';
  if (score >= 51) return 'MEDIUM';
  return 'LOW';
}

/**
 * Calculates and persists the seasonal sustainability score for the entire farm
 * normalized across the 3 core components (Max 100 points):
 * 
 * 1. Adoption of Recommended Practice (Max 50 pts):
 *    - 50 pts if seasonal audit by authorized auditor is verified ADOPTED.
 *    - 0 pts if NOT_ADOPTED, pending, or un-audited.
 * 
 * 2. Continued Historical Adoption (Max 30 pts):
 *    - Formula: round((Adopted Audited Seasons / Total Audited Seasons) * 30)
 *    - Special First-Time Adopter Rule: If no previous audited history and current season is ADOPTED, award 30 pts.
 *    - Unaudited current season receives 0 continuity points if no history exists.
 * 
 * 3. Seasonal Audit / Field Verification (Max 20 pts):
 *    - 20 pts if a valid seasonal audit exists with a valid audit_date by an authorized auditor.
 *    - 0 pts if un-audited.
 * 
 * Total = 50 + 30 + 20 = 100 pts max.
 */
async function calculateAndPersistScore(farmId, seasonId, agriculturalYear) {
  if (!farmId || !seasonId || !agriculturalYear) {
    const error = new Error('farm_id, season_id, and agricultural_year are required');
    error.statusCode = 400;
    throw error;
  }

  const parsedFarmId = parseInt(farmId, 10);
  const parsedSeasonId = parseInt(seasonId, 10);
  const cleanYear = String(agriculturalYear).trim();

  // 1. Verify farm exists
  const farmCheck = await query('SELECT farm_id, village_id FROM farms WHERE farm_id = $1', [parsedFarmId]);
  if (farmCheck.rows.length === 0) {
    const error = new Error(`Farm with ID ${parsedFarmId} not found`);
    error.statusCode = 404;
    throw error;
  }

  // 2. Fetch all seasonal crop records for this farm, season, year
  const recordRes = await query(`
    SELECT r.record_id, r.farm_id, r.season_id, r.agricultural_year, r.crop_id,
           r.current_irrigation_method_id, r.cultivated_area_hectares
    FROM farm_crop_records r
    WHERE r.farm_id = $1 AND r.season_id = $2 AND r.agricultural_year = $3
  `, [parsedFarmId, parsedSeasonId, cleanYear]);

  const currentRecords = recordRes.rows;

  // 3. Fetch all seasonal audits for these crop records
  let currentAudits = [];
  if (currentRecords.length > 0) {
    const recordIds = currentRecords.map(r => r.record_id);
    const auditRes = await query(`
      SELECT a.audit_id, a.record_id, a.adoption_status, a.actual_irrigation_method_id, a.audit_date
      FROM audits a
      WHERE a.record_id = ANY($1::int[])
    `, [recordIds]);
    currentAudits = auditRes.rows;
  }

  // --- Component 1: Adoption Score (0 or 50 pts) ---
  // Authoritative source: verified seasonal field audit by Auditor
  let adoptionScore = 0;
  const verifiedAdoptedAudits = currentAudits.filter(a => a.adoption_status === 'ADOPTED' && a.audit_date);
  if (verifiedAdoptedAudits.length > 0) {
    adoptionScore = 50;
  }

  // --- Component 2: Continued Historical Adoption (0 to 30 pts) ---
  // Evaluates continuity across all historical audited seasonal records for the entire farm
  let continuedAdoptionScore = 0;
  const historyRes = await query(`
    SELECT r.record_id, r.season_id, r.agricultural_year, a.adoption_status
    FROM farm_crop_records r
    JOIN audits a ON r.record_id = a.record_id
    WHERE r.farm_id = $1 AND a.adoption_status IN ('ADOPTED', 'NOT_ADOPTED')
  `, [parsedFarmId]);

  const auditedSeasons = historyRes.rows;
  if (auditedSeasons.length > 0) {
    const adoptedCount = auditedSeasons.filter(h => h.adoption_status === 'ADOPTED').length;
    continuedAdoptionScore = Math.round((adoptedCount / auditedSeasons.length) * 30);
  } else if (adoptionScore === 50) {
    // First-time verified adopter baseline rule
    continuedAdoptionScore = 30;
  }

  // --- Component 3: Seasonal Audit Verification Score (0 or 20 pts) ---
  // Measures whether an authorized auditor completed field verification for the farm's season
  let auditScore = 0;
  const validAudits = currentAudits.filter(a => a.audit_id && a.audit_date && 
      (a.adoption_status === 'ADOPTED' || a.adoption_status === 'NOT_ADOPTED'));
  if (validAudits.length > 0) {
    auditScore = 20;
  }

  // Calculate Total & Clamp (0 - 100)
  const complianceScore = 0;
  const sustainabilityScore = Math.min(100, Math.max(0, adoptionScore + continuedAdoptionScore + auditScore));
  const priority = derivePriority(sustainabilityScore);

  // Persist / Upsert into PostgreSQL table sustainability_scores
  const upsertRes = await query(`
    INSERT INTO sustainability_scores (
      farm_id, season_id, agricultural_year,
      adoption_score, continued_adoption_score, audit_score, compliance_score,
      sustainability_score, priority, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    ON CONFLICT (farm_id, season_id, agricultural_year) DO UPDATE SET
      adoption_score = EXCLUDED.adoption_score,
      continued_adoption_score = EXCLUDED.continued_adoption_score,
      audit_score = EXCLUDED.audit_score,
      compliance_score = EXCLUDED.compliance_score,
      sustainability_score = EXCLUDED.sustainability_score,
      priority = EXCLUDED.priority,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `, [
    parsedFarmId,
    parsedSeasonId,
    cleanYear,
    adoptionScore,
    continuedAdoptionScore,
    auditScore,
    complianceScore,
    sustainabilityScore,
    priority
  ]);

  const saved = upsertRes.rows[0];

  return {
    score_id: saved.score_id,
    farm_id: saved.farm_id,
    season_id: saved.season_id,
    agricultural_year: saved.agricultural_year,
    scores: {
      adoption: saved.adoption_score,
      continued_adoption: saved.continued_adoption_score,
      audit: saved.audit_score
    },
    sustainability_score: saved.sustainability_score,
    priority: saved.priority,
    created_at: saved.created_at,
    updated_at: saved.updated_at
  };
}

/**
 * Retrieves the persisted sustainability score for a farm in a given season/year.
 */
async function getScoreByFarm(farmId, seasonId, agriculturalYear) {
  let q = `
    SELECT s.*, f.name as farm_name, f.village_id, v.name as village_name,
           d.district_id, d.name as district_name, sea.name as season_name
    FROM sustainability_scores s
    JOIN farms f ON s.farm_id = f.farm_id
    JOIN villages v ON f.village_id = v.village_id
    JOIN districts d ON v.district_id = d.district_id
    JOIN seasons sea ON s.season_id = sea.season_id
    WHERE s.farm_id = $1
  `;
  const params = [farmId];

  if (seasonId) {
    params.push(seasonId);
    q += ` AND s.season_id = $${params.length}`;
  }
  if (agriculturalYear) {
    params.push(agriculturalYear);
    q += ` AND s.agricultural_year = $${params.length}`;
  }

  q += ` ORDER BY s.updated_at DESC LIMIT 1`;

  const res = await query(q, params);
  if (res.rows.length === 0) return null;

  const saved = res.rows[0];
  return {
    score_id: saved.score_id,
    farm_id: saved.farm_id,
    farm_name: saved.farm_name,
    village_id: saved.village_id,
    village_name: saved.village_name,
    district_id: saved.district_id,
    district_name: saved.district_name,
    season_id: saved.season_id,
    season_name: saved.season_name,
    agricultural_year: saved.agricultural_year,
    scores: {
      adoption: saved.adoption_score,
      continued_adoption: saved.continued_adoption_score,
      audit: saved.audit_score
    },
    sustainability_score: saved.sustainability_score,
    priority: saved.priority,
    created_at: saved.created_at,
    updated_at: saved.updated_at
  };
}

/**
 * Lists sustainability scores with optional district/village/season filters.
 */
async function listScores(filters = {}) {
  let q = `
    SELECT s.*, f.name as farm_name, f.owner_name, f.village_id, v.name as village_name,
           d.district_id, d.name as district_name, sea.name as season_name
    FROM sustainability_scores s
    JOIN farms f ON s.farm_id = f.farm_id
    JOIN villages v ON f.village_id = v.village_id
    JOIN districts d ON v.district_id = d.district_id
    JOIN seasons sea ON s.season_id = sea.season_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.districtId) {
    params.push(filters.districtId);
    q += ` AND d.district_id = $${params.length}`;
  }

  if (filters.villageId) {
    params.push(filters.villageId);
    q += ` AND v.village_id = $${params.length}`;
  }

  if (filters.seasonId) {
    params.push(filters.seasonId);
    q += ` AND s.season_id = $${params.length}`;
  }

  if (filters.agriculturalYear) {
    params.push(filters.agriculturalYear);
    q += ` AND s.agricultural_year = $${params.length}`;
  }

  q += ` ORDER BY s.sustainability_score DESC, s.updated_at DESC`;

  const res = await query(q, params);
  return res.rows.map(saved => ({
    score_id: saved.score_id,
    farm_id: saved.farm_id,
    farm_name: saved.farm_name,
    owner_name: saved.owner_name,
    village_id: saved.village_id,
    village_name: saved.village_name,
    district_id: saved.district_id,
    district_name: saved.district_name,
    season_id: saved.season_id,
    season_name: saved.season_name,
    agricultural_year: saved.agricultural_year,
    scores: {
      adoption: saved.adoption_score,
      continued_adoption: saved.continued_adoption_score,
      audit: saved.audit_score
    },
    sustainability_score: saved.sustainability_score,
    priority: saved.priority,
    created_at: saved.created_at,
    updated_at: saved.updated_at
  }));
}

module.exports = {
  calculateAndPersistScore,
  getScoreByFarm,
  listScores,
  derivePriority
};
