const agricultureService = require('../services/agriculture.service');

async function getSeasons(req, res, next) {
  try {
    const seasons = await agricultureService.getSeasons();
    res.json({ status: 'SUCCESS', data: seasons });
  } catch (err) {
    next(err);
  }
}

async function getCrops(req, res, next) {
  try {
    const seasonId = req.query.seasonId ? parseInt(req.query.seasonId, 10) : null;
    const crops = await agricultureService.getCrops(seasonId);
    res.json({ status: 'SUCCESS', data: crops });
  } catch (err) {
    next(err);
  }
}

async function getIrrigationMethods(req, res, next) {
  try {
    const methods = await agricultureService.getIrrigationMethods();
    res.json({ status: 'SUCCESS', data: methods });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSeasons,
  getCrops,
  getIrrigationMethods
};
