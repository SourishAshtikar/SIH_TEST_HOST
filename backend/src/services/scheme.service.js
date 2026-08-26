const { query } = require('../db');

function isValidUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Creates a new informational government scheme (ADMIN only)
 */
const createScheme = async ({
  name,
  description,
  government_level,
  benefit_description,
  eligibility,
  application_information,
  external_link
}) => {
  // 1. Validate name
  if (!name || typeof name !== 'string' || !name.trim()) {
    const error = new Error('Scheme name is required');
    error.statusCode = 400;
    throw error;
  }

  // 2. Validate description
  if (!description || typeof description !== 'string' || !description.trim()) {
    const error = new Error('Scheme description is required');
    error.statusCode = 400;
    throw error;
  }

  // 3. Validate external_link if provided
  if (external_link !== undefined && external_link !== null && external_link.trim() !== '') {
    if (typeof external_link !== 'string' || !isValidUrl(external_link.trim())) {
      const error = new Error('Invalid external_link URL format. Must start with http:// or https://');
      error.statusCode = 400;
      throw error;
    }
  }

  const cleanName = name.trim();
  const cleanDescription = description.trim();
  const cleanGovLevel = government_level && typeof government_level === 'string' ? government_level.trim().toUpperCase() : 'STATE';
  const cleanBenefit = benefit_description && typeof benefit_description === 'string' ? benefit_description.trim() : null;
  const cleanEligibility = eligibility && typeof eligibility === 'string' ? eligibility.trim() : null;
  const cleanAppInfo = application_information && typeof application_information === 'string' ? application_information.trim() : null;
  const cleanLink = external_link && typeof external_link === 'string' && external_link.trim() ? external_link.trim() : null;

  const result = await query(
    `INSERT INTO schemes (
      name, description, government_level, benefit_description, eligibility, application_information, external_link
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING scheme_id, name, description, government_level, benefit_description, eligibility, application_information, external_link, created_at, updated_at`,
    [cleanName, cleanDescription, cleanGovLevel, cleanBenefit, cleanEligibility, cleanAppInfo, cleanLink]
  );

  return result.rows[0];
};

/**
 * Returns all informational government schemes
 */
const getSchemes = async () => {
  const result = await query(
    `SELECT scheme_id, name, description, government_level, benefit_description, eligibility, application_information, external_link, created_at, updated_at
     FROM schemes
     ORDER BY scheme_id ASC`
  );
  return result.rows;
};

/**
 * Returns a single informational government scheme by ID
 */
const getSchemeById = async (schemeId) => {
  const parsedSchemeId = parseInt(schemeId, 10);
  if (isNaN(parsedSchemeId)) {
    const error = new Error('Valid numeric scheme_id is required');
    error.statusCode = 400;
    throw error;
  }

  const result = await query(
    `SELECT scheme_id, name, description, government_level, benefit_description, eligibility, application_information, external_link, created_at, updated_at
     FROM schemes
     WHERE scheme_id = $1`,
    [parsedSchemeId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Government scheme not found');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

/**
 * Updates an informational government scheme (ADMIN only)
 */
const updateScheme = async (schemeId, {
  name,
  description,
  government_level,
  benefit_description,
  eligibility,
  application_information,
  external_link
}) => {
  const parsedSchemeId = parseInt(schemeId, 10);
  if (isNaN(parsedSchemeId)) {
    const error = new Error('Valid numeric scheme_id is required');
    error.statusCode = 400;
    throw error;
  }

  // 1. Verify scheme existence
  const existingRes = await query('SELECT scheme_id, name, description, government_level, benefit_description, eligibility, application_information, external_link FROM schemes WHERE scheme_id = $1', [parsedSchemeId]);
  if (existingRes.rows.length === 0) {
    const error = new Error('Government scheme not found');
    error.statusCode = 404;
    throw error;
  }

  const existing = existingRes.rows[0];

  // 2. Validate input fields
  let updatedName = existing.name;
  if (name !== undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      const error = new Error('Scheme name cannot be empty');
      error.statusCode = 400;
      throw error;
    }
    updatedName = name.trim();
  }

  let updatedDescription = existing.description;
  if (description !== undefined) {
    if (!description || typeof description !== 'string' || !description.trim()) {
      const error = new Error('Scheme description cannot be empty');
      error.statusCode = 400;
      throw error;
    }
    updatedDescription = description.trim();
  }

  let updatedGovLevel = existing.government_level;
  if (government_level !== undefined) {
    if (government_level && typeof government_level === 'string') {
      updatedGovLevel = government_level.trim().toUpperCase();
    }
  }

  let updatedBenefit = existing.benefit_description;
  if (benefit_description !== undefined) {
    updatedBenefit = benefit_description && typeof benefit_description === 'string' ? benefit_description.trim() : null;
  }

  let updatedEligibility = existing.eligibility;
  if (eligibility !== undefined) {
    updatedEligibility = eligibility && typeof eligibility === 'string' ? eligibility.trim() : null;
  }

  let updatedAppInfo = existing.application_information;
  if (application_information !== undefined) {
    updatedAppInfo = application_information && typeof application_information === 'string' ? application_information.trim() : null;
  }

  let updatedLink = existing.external_link;
  if (external_link !== undefined) {
    if (external_link !== null && external_link.trim() !== '') {
      if (typeof external_link !== 'string' || !isValidUrl(external_link.trim())) {
        const error = new Error('Invalid external_link URL format. Must start with http:// or https://');
        error.statusCode = 400;
        throw error;
      }
      updatedLink = external_link.trim();
    } else {
      updatedLink = null;
    }
  }

  const result = await query(
    `UPDATE schemes
     SET name = $1,
         description = $2,
         government_level = $3,
         benefit_description = $4,
         eligibility = $5,
         application_information = $6,
         external_link = $7,
         updated_at = CURRENT_TIMESTAMP
     WHERE scheme_id = $8
     RETURNING scheme_id, name, description, government_level, benefit_description, eligibility, application_information, external_link, created_at, updated_at`,
    [updatedName, updatedDescription, updatedGovLevel, updatedBenefit, updatedEligibility, updatedAppInfo, updatedLink, parsedSchemeId]
  );

  return result.rows[0];
};

/**
 * Deletes an informational government scheme (ADMIN only)
 */
const deleteScheme = async (schemeId) => {
  const parsedSchemeId = parseInt(schemeId, 10);
  if (isNaN(parsedSchemeId)) {
    const error = new Error('Valid numeric scheme_id is required');
    error.statusCode = 400;
    throw error;
  }

  const check = await query('SELECT scheme_id, name FROM schemes WHERE scheme_id = $1', [parsedSchemeId]);
  if (check.rows.length === 0) {
    const error = new Error('Government scheme not found');
    error.statusCode = 404;
    throw error;
  }

  await query('DELETE FROM schemes WHERE scheme_id = $1', [parsedSchemeId]);
  return { scheme_id: parsedSchemeId, name: check.rows[0].name };
};

module.exports = {
  createScheme,
  getSchemes,
  getSchemeById,
  updateScheme,
  deleteScheme
};
