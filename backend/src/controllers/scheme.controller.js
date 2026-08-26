const schemeService = require('../services/scheme.service');

const createScheme = async (req, res) => {
  try {
    const { name, description, government_level, benefit_description, eligibility, application_information, external_link } = req.body || {};
    const scheme = await schemeService.createScheme({
      name,
      description,
      government_level,
      benefit_description,
      eligibility,
      application_information,
      external_link
    });

    return res.status(201).json({
      status: 'success',
      message: 'Government scheme created successfully',
      data: {
        scheme
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while creating the government scheme'
    });
  }
};

const getSchemes = async (req, res) => {
  try {
    const schemes = await schemeService.getSchemes();
    return res.status(200).json({
      status: 'success',
      data: {
        schemes
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while retrieving government schemes'
    });
  }
};

const getSchemeById = async (req, res) => {
  try {
    const scheme = await schemeService.getSchemeById(req.params.id);
    return res.status(200).json({
      status: 'success',
      data: {
        scheme
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while retrieving the government scheme'
    });
  }
};

const updateScheme = async (req, res) => {
  try {
    const { name, description, government_level, benefit_description, eligibility, application_information, external_link } = req.body || {};
    const scheme = await schemeService.updateScheme(req.params.id, {
      name,
      description,
      government_level,
      benefit_description,
      eligibility,
      application_information,
      external_link
    });

    return res.status(200).json({
      status: 'success',
      message: 'Government scheme updated successfully',
      data: {
        scheme
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while updating the government scheme'
    });
  }
};

const deleteScheme = async (req, res) => {
  try {
    const result = await schemeService.deleteScheme(req.params.id);
    return res.status(200).json({
      status: 'success',
      message: 'Government scheme deleted successfully',
      data: result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while deleting the government scheme'
    });
  }
};

module.exports = {
  createScheme,
  getSchemes,
  getSchemeById,
  updateScheme,
  deleteScheme
};
