const mlService = require('../services/ml.service');

const getPrediction = async (req, res, next) => {
  try {
    const { District, Tehsil, Block, Station, Latitude, Longitude, Year, Month } = req.body;

    // Basic validation
    if (!District || !Tehsil || !Block || !Station || Latitude === undefined || Longitude === undefined || !Year || !Month) {
      const error = new Error('All fields (District, Tehsil, Block, Station, Latitude, Longitude, Year, Month) are required');
      error.statusCode = 400;
      throw error;
    }

    const predictedLevel = await mlService.getGroundwaterPrediction(req.body);

    res.json({
      success: true,
      message: "Prediction retrieved successfully",
      predicted_gwl_meters: predictedLevel
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPrediction
};
