const groundwaterHeatmapService = require('../services/groundwaterHeatmap.service');

const getHeatmapPredictions = async (req, res) => {
  try {
    const data = await groundwaterHeatmapService.getHeatmapPredictions(req.user);

    return res.status(200).json({
      status: 'success',
      data
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Failed to retrieve groundwater heatmap predictions'
    });
  }
};

module.exports = {
  getHeatmapPredictions
};
