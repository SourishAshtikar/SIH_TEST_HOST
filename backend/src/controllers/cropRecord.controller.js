const cropRecordService = require('../services/cropRecord.service');

const createCropRecord = async (req, res) => {
  try {
    const { farm_id } = req.params;
    const { season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id } = req.body || {};
    const record = await cropRecordService.createCropRecord(req.user.id, farm_id, {
      season_id,
      agricultural_year,
      crop_id,
      cultivated_area_hectares,
      current_irrigation_method_id
    });

    return res.status(201).json({
      status: 'success',
      message: 'Seasonal crop record created successfully',
      data: {
        record
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while creating the seasonal crop record'
    });
  }
};

const getCropRecordsByFarm = async (req, res) => {
  try {
    const { farm_id } = req.params;
    const records = await cropRecordService.getCropRecordsByFarm(req.user.id, farm_id);

    return res.status(200).json({
      status: 'success',
      data: {
        records
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while retrieving seasonal crop records'
    });
  }
};

const getCropRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await cropRecordService.getCropRecordById(req.user.id, id);

    return res.status(200).json({
      status: 'success',
      data: {
        record
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while retrieving the seasonal crop record'
    });
  }
};

const updateCropRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { farm_id, season_id, agricultural_year, crop_id, cultivated_area_hectares, current_irrigation_method_id } = req.body || {};
    const record = await cropRecordService.updateCropRecord(req.user.id, id, {
      farm_id,
      season_id,
      agricultural_year,
      crop_id,
      cultivated_area_hectares,
      current_irrigation_method_id
    });

    return res.status(200).json({
      status: 'success',
      message: 'Seasonal crop record updated successfully',
      data: {
        record
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while updating the seasonal crop record'
    });
  }
};

module.exports = {
  createCropRecord,
  getCropRecordsByFarm,
  getCropRecordById,
  updateCropRecord
};
