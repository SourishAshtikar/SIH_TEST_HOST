const groundwaterAssessmentService = require('../services/groundwaterAssessment.service');

async function getAssessments(req, res, next) {
  try {
    const { year, scope } = req.query;

    if (!year) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Query parameter "year" is required'
      });
    }

    const data = await groundwaterAssessmentService.getAssessments(year, scope || 'district');
    res.status(200).json({
      status: 'SUCCESS',
      data
    });
  } catch (err) {
    next(err);
  }
}

async function getDetails(req, res, next) {
  try {
    const { scope, id, year } = req.query;

    if (!year) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Query parameter "year" is required'
      });
    }

    const data = await groundwaterAssessmentService.getDetails(scope || 'state', id, year);
    res.status(200).json({
      status: 'SUCCESS',
      data
    });
  } catch (err) {
    next(err);
  }
}

async function getYears(req, res, next) {
  try {
    const data = await groundwaterAssessmentService.getYears();
    res.status(200).json({
      status: 'SUCCESS',
      data: { years: data }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAssessments,
  getDetails,
  getYears
};
