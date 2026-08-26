const recommendationService = require('../services/recommendation.service');

async function getRecommendation(req, res, next) {
  try {
    const recommendation = await recommendationService.generateRecommendation(req.body);
    res.json({
      status: 'SUCCESS',
      data: recommendation
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRecommendation
};
