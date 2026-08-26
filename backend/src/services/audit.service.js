const { query } = require('../db');

const ALLOWED_ADOPTION_STATUSES = Object.freeze(['PENDING', 'ADOPTED', 'NOT_ADOPTED']);

/**
 * Helper to fetch authenticated user with current geographic assignment
 */
async function getUserWithGeography(userId) {
  const result = await query('SELECT id, name, email, role, district_id, village_id FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
}

/**
 * Helper to fetch crop record with farm, village, and district hierarchy
 */
async function getCropRecordGeography(recordId) {
  const result = await query(
    `SELECT r.record_id, r.farm_id, r.season_id, r.crop_id, r.agricultural_year, r.current_irrigation_method_id,
            f.name AS farm_name, f.village_id,
            v.district_id, v.name AS village_name,
            d.name AS district_name
     FROM farm_crop_records r
     JOIN farms f ON f.farm_id = r.farm_id
     JOIN villages v ON v.village_id = f.village_id
     JOIN districts d ON d.district_id = v.district_id
     WHERE r.record_id = $1`,
    [recordId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Farm crop record not found');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

/**
 * Helper to fetch audit with its complete relational geography hierarchy
 */
async function getAuditWithGeography(auditId) {
  const result = await query(
    `SELECT a.audit_id, a.record_id, a.auditor_id, a.actual_irrigation_method_id, a.adoption_status,
            a.audit_date, a.notes, a.created_at,
            u.name AS auditor_name,
            im.name AS actual_irrigation_method_name,
            r.farm_id, r.season_id, r.crop_id, r.agricultural_year, r.cultivated_area_hectares,
            f.name AS farm_name, f.village_id,
            v.name AS village_name, v.district_id,
            d.name AS district_name
     FROM audits a
     JOIN users u ON u.id = a.auditor_id
     JOIN farm_crop_records r ON r.record_id = a.record_id
     JOIN farms f ON f.farm_id = r.farm_id
     JOIN villages v ON v.village_id = f.village_id
     JOIN districts d ON d.district_id = v.district_id
     LEFT JOIN irrigation_methods im ON im.method_id = a.actual_irrigation_method_id
     WHERE a.audit_id = $1`,
    [auditId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Audit not found');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

/**
 * Create a new seasonal audit record for a farm crop record
 */
const createAudit = async (userId, { record_id, actual_irrigation_method_id, adoption_status, audit_date, notes }) => {
  const user = await getUserWithGeography(userId);

  // 1. Role verification
  if (user.role !== 'AUDITOR') {
    const error = new Error('Access forbidden: Only auditors may record audits');
    error.statusCode = 403;
    throw error;
  }

  // 2. Geographic assignment check
  if (!user.district_id) {
    const error = new Error('Access forbidden: Auditor is not assigned to any district');
    error.statusCode = 403;
    throw error;
  }

  // 3. Validate record_id
  if (record_id === undefined || record_id === null || isNaN(parseInt(record_id, 10))) {
    const error = new Error('Valid record_id is required');
    error.statusCode = 400;
    throw error;
  }

  const parsedRecordId = parseInt(record_id, 10);
  const cropRecord = await getCropRecordGeography(parsedRecordId);

  // 4. District-level authorization check
  if (cropRecord.district_id !== user.district_id) {
    const error = new Error('Access forbidden: You do not have audit authority over records outside your assigned district');
    error.statusCode = 403;
    throw error;
  }

  // 5. Validate adoption_status
  if (!adoption_status || typeof adoption_status !== 'string' || !ALLOWED_ADOPTION_STATUSES.includes(adoption_status.trim().toUpperCase())) {
    const error = new Error(`Invalid adoption_status. Allowed values are: ${ALLOWED_ADOPTION_STATUSES.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
  const cleanAdoptionStatus = adoption_status.trim().toUpperCase();

  // 6. Validate audit_date
  if (!audit_date || isNaN(Date.parse(audit_date))) {
    const error = new Error('Valid audit_date (YYYY-MM-DD) is required');
    error.statusCode = 400;
    throw error;
  }

  // 7. Validate actual_irrigation_method_id if provided
  let cleanMethodId = null;
  if (actual_irrigation_method_id !== undefined && actual_irrigation_method_id !== null) {
    const parsedMethodId = parseInt(actual_irrigation_method_id, 10);
    if (isNaN(parsedMethodId)) {
      const error = new Error('Invalid actual_irrigation_method_id');
      error.statusCode = 400;
      throw error;
    }
    const methodCheck = await query('SELECT method_id FROM irrigation_methods WHERE method_id = $1', [parsedMethodId]);
    if (methodCheck.rows.length === 0) {
      const error = new Error('Irrigation method does not exist');
      error.statusCode = 400;
      throw error;
    }
    cleanMethodId = parsedMethodId;
  }

  // 8. Validate notes
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    const error = new Error('Notes must be a string');
    error.statusCode = 400;
    throw error;
  }
  const cleanNotes = notes ? notes.trim() : null;

  // 9. Insert audit with authenticated user as auditor_id
  const result = await query(
    `INSERT INTO audits (record_id, auditor_id, actual_irrigation_method_id, adoption_status, audit_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING audit_id, record_id, auditor_id, actual_irrigation_method_id, adoption_status, audit_date, notes, created_at`,
    [parsedRecordId, user.id, cleanMethodId, cleanAdoptionStatus, audit_date, cleanNotes]
  );

  const savedAudit = result.rows[0];

  // Dynamically recalculate and persist the entire farm's sustainability score for this season/year
  try {
    const { calculateAndPersistScore } = require('./sustainabilityScore.service');
    await calculateAndPersistScore(cropRecord.farm_id, cropRecord.season_id, cropRecord.agricultural_year);
  } catch (e) {
    console.warn('Dynamic sustainability score update notification:', e.message);
  }

  return savedAudit;
};

/**
 * Retrieve single audit details with strict geographic authorization
 */
const getAuditById = async (userId, auditId) => {
  const user = await getUserWithGeography(userId);

  const parsedAuditId = parseInt(auditId, 10);
  if (isNaN(parsedAuditId)) {
    const error = new Error('Valid numeric audit_id is required');
    error.statusCode = 400;
    throw error;
  }

  const audit = await getAuditWithGeography(parsedAuditId);

  // Enforce role-based geographic access boundaries
  if (user.role === 'AUDITOR') {
    if (!user.district_id || audit.district_id !== user.district_id) {
      const error = new Error('Access forbidden: You do not have access to audits outside your assigned district');
      error.statusCode = 403;
      throw error;
    }
  } else if (user.role === 'VILLAGE_HEAD') {
    if (!user.village_id || audit.village_id !== user.village_id) {
      const error = new Error('Access forbidden: You do not have access to audits outside your assigned village');
      error.statusCode = 403;
      throw error;
    }
  } else {
    const error = new Error('Access forbidden: User role does not have permission to view audits');
    error.statusCode = 403;
    throw error;
  }

  return audit;
};

/**
 * List crop records and their audit statuses within the user's authorized geographic scope
 */
const getAudits = async (userId) => {
  const user = await getUserWithGeography(userId);

  if (user.role === 'AUDITOR') {
    if (!user.district_id) {
      const error = new Error('Access forbidden: Auditor is not assigned to any district');
      error.statusCode = 403;
      throw error;
    }

    const result = await query(
      `SELECT a.audit_id, r.record_id, a.auditor_id, a.actual_irrigation_method_id,
              COALESCE(a.adoption_status, 'UNAUDITED') AS adoption_status,
              a.audit_date, a.notes, a.created_at,
              u.name AS auditor_name,
              im_actual.name AS actual_irrigation_method_name,
              im_curr.name AS current_irrigation_method_name,
              c.name AS crop_name,
              s.name AS season_name,
              r.farm_id, r.agricultural_year, r.cultivated_area_hectares,
              f.name AS farm_name, f.village_id,
              v.name AS village_name, v.district_id,
              d.name AS district_name
       FROM farm_crop_records r
       JOIN farms f ON f.farm_id = r.farm_id
       JOIN villages v ON v.village_id = f.village_id
       JOIN districts d ON d.district_id = v.district_id
       LEFT JOIN crops c ON c.crop_id = r.crop_id
       LEFT JOIN seasons s ON s.season_id = r.season_id
       LEFT JOIN irrigation_methods im_curr ON im_curr.method_id = r.current_irrigation_method_id
       LEFT JOIN audits a ON a.record_id = r.record_id
       LEFT JOIN users u ON u.id = a.auditor_id
       LEFT JOIN irrigation_methods im_actual ON im_actual.method_id = a.actual_irrigation_method_id
       WHERE v.district_id = $1
       ORDER BY r.record_id DESC`,
      [user.district_id]
    );

    return result.rows;

  } else if (user.role === 'VILLAGE_HEAD') {
    if (!user.village_id) {
      const error = new Error('Access forbidden: Village Head is not assigned to any village');
      error.statusCode = 403;
      throw error;
    }

    const result = await query(
      `SELECT a.audit_id, r.record_id, a.auditor_id, a.actual_irrigation_method_id,
              COALESCE(a.adoption_status, 'UNAUDITED') AS adoption_status,
              a.audit_date, a.notes, a.created_at,
              u.name AS auditor_name,
              im_actual.name AS actual_irrigation_method_name,
              im_curr.name AS current_irrigation_method_name,
              c.name AS crop_name,
              s.name AS season_name,
              r.farm_id, r.agricultural_year, r.cultivated_area_hectares,
              f.name AS farm_name, f.village_id,
              v.name AS village_name, v.district_id,
              d.name AS district_name
       FROM farm_crop_records r
       JOIN farms f ON f.farm_id = r.farm_id
       JOIN villages v ON v.village_id = f.village_id
       JOIN districts d ON d.district_id = v.district_id
       LEFT JOIN crops c ON c.crop_id = r.crop_id
       LEFT JOIN seasons s ON s.season_id = r.season_id
       LEFT JOIN irrigation_methods im_curr ON im_curr.method_id = r.current_irrigation_method_id
       LEFT JOIN audits a ON a.record_id = r.record_id
       LEFT JOIN users u ON u.id = a.auditor_id
       LEFT JOIN irrigation_methods im_actual ON im_actual.method_id = a.actual_irrigation_method_id
       WHERE f.village_id = $1
       ORDER BY r.record_id DESC`,
      [user.village_id]
    );

    return result.rows;

  } else {
    const error = new Error('Access forbidden: User role does not have permission to list audits');
    error.statusCode = 403;
    throw error;
  }
};

/**
 * Update audit verification data by authorized district auditor
 */
const updateAudit = async (userId, auditId, { actual_irrigation_method_id, adoption_status, audit_date, notes }) => {
  const user = await getUserWithGeography(userId);

  // 1. Role verification: ONLY AUDITOR can update
  if (user.role !== 'AUDITOR') {
    const error = new Error('Access forbidden: Only auditors may modify audit verification records');
    error.statusCode = 403;
    throw error;
  }

  // 2. Geographic assignment check
  if (!user.district_id) {
    const error = new Error('Access forbidden: Auditor is not assigned to any district');
    error.statusCode = 403;
    throw error;
  }

  const parsedAuditId = parseInt(auditId, 10);
  if (isNaN(parsedAuditId)) {
    const error = new Error('Valid numeric audit_id is required');
    error.statusCode = 400;
    throw error;
  }

  // 3. Fetch existing audit
  const existingAudit = await getAuditWithGeography(parsedAuditId);

  // 4. District authorization check
  if (existingAudit.district_id !== user.district_id) {
    const error = new Error('Access forbidden: You do not have audit authority over records outside your assigned district');
    error.statusCode = 403;
    throw error;
  }

  // 5. Validate updates
  let updatedMethodId = existingAudit.actual_irrigation_method_id;
  if (actual_irrigation_method_id !== undefined) {
    if (actual_irrigation_method_id === null) {
      updatedMethodId = null;
    } else {
      const parsedMethodId = parseInt(actual_irrigation_method_id, 10);
      if (isNaN(parsedMethodId)) {
        const error = new Error('Invalid actual_irrigation_method_id');
        error.statusCode = 400;
        throw error;
      }
      const methodCheck = await query('SELECT method_id FROM irrigation_methods WHERE method_id = $1', [parsedMethodId]);
      if (methodCheck.rows.length === 0) {
        const error = new Error('Irrigation method does not exist');
        error.statusCode = 400;
        throw error;
      }
      updatedMethodId = parsedMethodId;
    }
  }

  let updatedAdoptionStatus = existingAudit.adoption_status;
  if (adoption_status !== undefined) {
    if (!adoption_status || typeof adoption_status !== 'string' || !ALLOWED_ADOPTION_STATUSES.includes(adoption_status.trim().toUpperCase())) {
      const error = new Error(`Invalid adoption_status. Allowed values are: ${ALLOWED_ADOPTION_STATUSES.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }
    updatedAdoptionStatus = adoption_status.trim().toUpperCase();
  }

  let updatedAuditDate = existingAudit.audit_date;
  if (audit_date !== undefined) {
    if (!audit_date || isNaN(Date.parse(audit_date))) {
      const error = new Error('Valid audit_date (YYYY-MM-DD) is required');
      error.statusCode = 400;
      throw error;
    }
    updatedAuditDate = audit_date;
  }

  let updatedNotes = existingAudit.notes;
  if (notes !== undefined) {
    if (notes !== null && typeof notes !== 'string') {
      const error = new Error('Notes must be a string');
      error.statusCode = 400;
      throw error;
    }
    updatedNotes = notes ? notes.trim() : null;
  }

  // 6. Update audit using parameterized query (auditor_id remains unchanged)
  const result = await query(
    `UPDATE audits
     SET actual_irrigation_method_id = $1,
         adoption_status = $2,
         audit_date = $3,
         notes = $4
     WHERE audit_id = $5
     RETURNING audit_id, record_id, auditor_id, actual_irrigation_method_id, adoption_status, audit_date, notes, created_at`,
    [updatedMethodId, updatedAdoptionStatus, updatedAuditDate, updatedNotes, parsedAuditId]
  );

  const updatedAudit = result.rows[0];

  // Dynamically recalculate and persist the entire farm's sustainability score for this season/year
  try {
    const { calculateAndPersistScore } = require('./sustainabilityScore.service');
    await calculateAndPersistScore(existingAudit.farm_id, existingAudit.season_id, existingAudit.agricultural_year);
  } catch (e) {
    console.warn('Dynamic sustainability score update notification:', e.message);
  }

  return updatedAudit;
};

module.exports = {
  createAudit,
  getAuditById,
  getAudits,
  updateAudit,
  ALLOWED_ADOPTION_STATUSES
};
