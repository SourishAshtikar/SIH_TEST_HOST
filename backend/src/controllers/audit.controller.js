const auditService = require('../services/audit.service');

const createAudit = async (req, res) => {
  try {
    const { record_id, actual_irrigation_method_id, adoption_status, audit_date, notes } = req.body || {};
    const audit = await auditService.createAudit(req.user.id, {
      record_id,
      actual_irrigation_method_id,
      adoption_status,
      audit_date,
      notes
    });

    return res.status(201).json({
      status: 'success',
      message: 'Audit recorded successfully',
      data: {
        audit
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while recording the audit'
    });
  }
};

const getAuditById = async (req, res) => {
  try {
    const audit = await auditService.getAuditById(req.user.id, req.params.id);
    return res.status(200).json({
      status: 'success',
      data: {
        audit
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while retrieving the audit'
    });
  }
};

const getAudits = async (req, res) => {
  try {
    const audits = await auditService.getAudits(req.user.id);
    return res.status(200).json({
      status: 'success',
      data: {
        audits
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while retrieving audits'
    });
  }
};

const updateAudit = async (req, res) => {
  try {
    const { actual_irrigation_method_id, adoption_status, audit_date, notes } = req.body || {};
    const audit = await auditService.updateAudit(req.user.id, req.params.id, {
      actual_irrigation_method_id,
      adoption_status,
      audit_date,
      notes
    });

    return res.status(200).json({
      status: 'success',
      message: 'Audit updated successfully',
      data: {
        audit
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while updating the audit'
    });
  }
};

module.exports = {
  createAudit,
  getAuditById,
  getAudits,
  updateAudit
};
