const villageService = require('../services/village.service');

async function getStates(req, res, next) {
  try {
    const states = await villageService.getStates();
    res.json({ status: 'SUCCESS', data: states });
  } catch (err) {
    next(err);
  }
}

async function getDistricts(req, res, next) {
  try {
    const stateId = req.query.stateId ? parseInt(req.query.stateId, 10) : 1;
    const districts = await villageService.getDistricts(stateId);
    res.json({ status: 'SUCCESS', data: districts });
  } catch (err) {
    next(err);
  }
}

async function getVillages(req, res, next) {
  try {
    const districtId = req.query.districtId ? parseInt(req.query.districtId, 10) : null;
    const villages = await villageService.getVillages(districtId);
    res.json({ status: 'SUCCESS', data: villages });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStates,
  getDistricts,
  getVillages
};
