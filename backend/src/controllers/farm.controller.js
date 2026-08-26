const farmService = require('../services/farm.service');

const createFarm = async (req, res) => {
  try {
    const { name, owner_name, village_id, total_land_area_hectares } = req.body || {};
    const farm = await farmService.createFarm(req.user.id, {
      name,
      owner_name,
      village_id,
      total_land_area_hectares
    });

    return res.status(201).json({
      status: 'success',
      message: 'Farm created successfully',
      data: {
        farm
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while creating the farm'
    });
  }
};

const getFarms = async (req, res) => {
  try {
    const farms = await farmService.getFarms(req.user.id);
    return res.status(200).json({
      status: 'success',
      data: {
        farms
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while retrieving farms'
    });
  }
};

const getFarmById = async (req, res) => {
  try {
    const farm = await farmService.getFarmById(req.user.id, req.params.id);
    return res.status(200).json({
      status: 'success',
      data: {
        farm
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while retrieving the farm'
    });
  }
};

const updateFarm = async (req, res) => {
  try {
    const { name, owner_name, village_id, total_land_area_hectares } = req.body || {};
    const farm = await farmService.updateFarm(req.user.id, req.params.id, {
      name,
      owner_name,
      village_id,
      total_land_area_hectares
    });

    return res.status(200).json({
      status: 'success',
      message: 'Farm updated successfully',
      data: {
        farm
      }
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'An error occurred while updating the farm'
    });
  }
};

module.exports = {
  createFarm,
  getFarms,
  getFarmById,
  updateFarm
};
