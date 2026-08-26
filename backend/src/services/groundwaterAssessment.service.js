const { query } = require('../db');

/**
 * Get all assessments for a given year and scope (district or village)
 */
async function getAssessments(year, scope) {
  if (!year) {
    throw new Error('Year is required');
  }

  if (scope === 'village') {
    const sql = `
      SELECT ga.assessment_id, ga.village_id, v.name AS village_name,
             v.latitude, v.longitude, d.name AS district_name,
             ga.assessment_year, ga.is_predicted, ga.category,
             ga.dtw_m_bgl, ga.extractable_resources_bcm, ga.extraction_all_uses_bcm
      FROM groundwater_assessments ga
      JOIN villages v ON ga.village_id = v.village_id
      JOIN districts d ON v.district_id = d.district_id
      WHERE ga.assessment_year = $1 AND ga.district_id IS NULL
    `;
    const res = await query(sql, [year]);
    return res.rows;
  } else {
    // Default to district scope
    const sql = `
      SELECT ga.assessment_id, ga.district_id, d.name AS district_name,
             ga.assessment_year, ga.is_predicted, ga.category,
             ga.dtw_m_bgl, ga.extractable_resources_bcm, ga.extraction_all_uses_bcm
      FROM groundwater_assessments ga
      JOIN districts d ON ga.district_id = d.district_id
      WHERE ga.assessment_year = $1 AND ga.village_id IS NULL
    `;
    const res = await query(sql, [year]);
    return res.rows;
  }
}

/**
 * Get detailed statistics for a specific area of focus (state, district, or village) for a year
 */
async function getDetails(scope, id, year) {
  if (!year) {
    throw new Error('Year is required');
  }

  // 1. State Level Details (aggregate of all districts)
  if (scope === 'state' || !id) {
    const districtsSql = `
      SELECT ga.*, d.name AS district_name
      FROM groundwater_assessments ga
      JOIN districts d ON ga.district_id = d.district_id
      WHERE ga.assessment_year = $1 AND ga.village_id IS NULL
    `;
    const districtsRes = await query(districtsSql, [year]);
    const districts = districtsRes.rows;

    let totalExtractable = 0;
    let totalExtraction = 0;
    let totalRecharge = 0;
    let totalNaturalDischarges = 0;
    let sumRainfall = 0;
    let count = 0;

    districts.forEach(d => {
      totalExtractable += d.extractable_resources_bcm || 0;
      totalExtraction += d.extraction_all_uses_bcm || 0;
      totalRecharge += d.recharge_bcm || 0;
      totalNaturalDischarges += d.natural_discharges_bcm || 0;
      sumRainfall += d.rainfall_mm || 0;
      count++;
    });

    const avgRainfall = count > 0 ? sumRainfall / count : 0;
    const stage = totalExtractable > 0 ? (totalExtraction / totalExtractable) * 100 : 0;

    // Sub-regions are the districts themselves
    const subRegions = districts.map(d => ({
      id: d.district_id,
      name: d.district_name,
      rainfall_mm: d.rainfall_mm,
      extractable_resources_bcm: d.extractable_resources_bcm,
      extraction_all_uses_bcm: d.extraction_all_uses_bcm,
      category: d.category
    }));

    return {
      focusName: 'Haryana',
      focusType: 'STATE',
      breadcrumbs: ['INDIA', 'HARYANA'],
      year,
      is_predicted: districts.some(d => d.is_predicted),
      extractable_resources_bcm: totalExtractable,
      extraction_all_uses_bcm: totalExtraction,
      rainfall_mm: avgRainfall,
      recharge_bcm: totalRecharge,
      natural_discharges_bcm: totalNaturalDischarges,
      stage_of_extraction_pct: stage,
      dtw_m_bgl: null, // State-wide depth to water is not applicable
      category: null,
      subRegions
    };
  }

  // 2. District Level Details
  if (scope === 'district') {
    const districtId = parseInt(id, 10);
    const detailSql = `
      SELECT ga.*, d.name AS district_name
      FROM groundwater_assessments ga
      JOIN districts d ON ga.district_id = d.district_id
      WHERE ga.district_id = $1 AND ga.assessment_year = $2 AND ga.village_id IS NULL
    `;
    const detailRes = await query(detailSql, [districtId, year]);
    const detail = detailRes.rows[0];

    if (!detail) {
      throw new Error(`Groundwater assessment data not found for district ID ${districtId} and year ${year}`);
    }

    const stage = detail.extractable_resources_bcm > 0 ? (detail.extraction_all_uses_bcm / detail.extractable_resources_bcm) * 100 : 0;

    // Sub-regions are all villages in this district
    const subRegionsSql = `
      SELECT ga.*, v.name AS village_name, v.village_id
      FROM groundwater_assessments ga
      JOIN villages v ON ga.village_id = v.village_id
      WHERE v.district_id = $1 AND ga.assessment_year = $2 AND ga.district_id IS NULL
    `;
    const subRegionsRes = await query(subRegionsSql, [districtId, year]);
    const subRegions = subRegionsRes.rows.map(sr => ({
      id: sr.village_id,
      name: sr.village_name,
      rainfall_mm: sr.rainfall_mm,
      extractable_resources_bcm: sr.extractable_resources_bcm,
      extraction_all_uses_bcm: sr.extraction_all_uses_bcm,
      category: sr.category
    }));

    // Read actual dtw_m_bgl or fallback to category-based estimates
    let dtw = detail.dtw_m_bgl !== null && detail.dtw_m_bgl !== undefined ? detail.dtw_m_bgl : 12.0;
    if (detail.dtw_m_bgl === null || detail.dtw_m_bgl === undefined) {
      if (detail.category === 'Safe') dtw = 5.2;
      else if (detail.category === 'Semi Critical') dtw = 11.5;
      else if (detail.category === 'Critical') dtw = 17.8;
      else if (detail.category === 'Over Exploited') dtw = 26.4;
    }

    return {
      focusName: detail.district_name,
      focusType: 'DISTRICT',
      breadcrumbs: ['INDIA', 'HARYANA', detail.district_name.toUpperCase()],
      year,
      is_predicted: !!detail.is_predicted,
      extractable_resources_bcm: detail.extractable_resources_bcm,
      extraction_all_uses_bcm: detail.extraction_all_uses_bcm,
      rainfall_mm: detail.rainfall_mm,
      recharge_bcm: detail.recharge_bcm,
      natural_discharges_bcm: detail.natural_discharges_bcm,
      stage_of_extraction_pct: stage,
      dtw_m_bgl: dtw,
      category: detail.category,
      subRegions
    };
  }

  // 3. Village Level Details
  if (scope === 'village') {
    const villageId = parseInt(id, 10);
    const detailSql = `
      SELECT ga.*, v.name AS village_name, d.name AS district_name
      FROM groundwater_assessments ga
      JOIN villages v ON ga.village_id = v.village_id
      JOIN districts d ON v.district_id = d.district_id
      WHERE ga.village_id = $1 AND ga.assessment_year = $2 AND ga.district_id IS NULL
    `;
    const detailRes = await query(detailSql, [villageId, year]);
    const detail = detailRes.rows[0];

    if (!detail) {
      throw new Error(`Groundwater assessment data not found for village ID ${villageId} and year ${year}`);
    }

    const stage = detail.extractable_resources_bcm > 0 ? (detail.extraction_all_uses_bcm / detail.extractable_resources_bcm) * 100 : 0;

    // Sub-regions is just the village itself
    const subRegions = [{
      id: detail.village_id,
      name: detail.village_name,
      rainfall_mm: detail.rainfall_mm,
      extractable_resources_bcm: detail.extractable_resources_bcm,
      extraction_all_uses_bcm: detail.extraction_all_uses_bcm,
      category: detail.category
    }];

    let dtw = detail.dtw_m_bgl !== null && detail.dtw_m_bgl !== undefined ? detail.dtw_m_bgl : 12.0;
    if (detail.dtw_m_bgl === null || detail.dtw_m_bgl === undefined) {
      if (detail.category === 'Safe') dtw = 4.8;
      else if (detail.category === 'Semi Critical') dtw = 10.2;
      else if (detail.category === 'Critical') dtw = 16.5;
      else if (detail.category === 'Over Exploited') dtw = 28.1;
    }

    return {
      focusName: detail.village_name,
      focusType: 'VILLAGE',
      breadcrumbs: ['INDIA', 'HARYANA', detail.district_name.toUpperCase(), detail.village_name.toUpperCase()],
      year,
      is_predicted: !!detail.is_predicted,
      extractable_resources_bcm: detail.extractable_resources_bcm,
      extraction_all_uses_bcm: detail.extraction_all_uses_bcm,
      rainfall_mm: detail.rainfall_mm,
      recharge_bcm: detail.recharge_bcm,
      natural_discharges_bcm: detail.natural_discharges_bcm,
      stage_of_extraction_pct: stage,
      dtw_m_bgl: dtw,
      category: detail.category,
      subRegions
    };
  }

  throw new Error(`Invalid scope type: ${scope}`);
}

async function getYears() {
  const yearsRes = await query('SELECT DISTINCT assessment_year FROM groundwater_assessments ORDER BY assessment_year');
  return yearsRes.rows.map(r => r.assessment_year);
}

module.exports = {
  getAssessments,
  getDetails,
  getYears
};
