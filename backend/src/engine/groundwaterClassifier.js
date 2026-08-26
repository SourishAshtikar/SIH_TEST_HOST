const thresholds = require('../config/groundwaterThresholds.json');

function classifyGroundwater(levelMeters, trend) {
  if (levelMeters === null || levelMeters === undefined || isNaN(levelMeters)) {
    return {
      category: 'HIGH',
      priority: 'HIGH',
      action: 'CHANGE_RECOMMENDED'
    };
  }

  const declThreshold = thresholds.decliningTrendOverrideDepthMeters || 8.5;
  if (trend === 'DECLINING' && levelMeters >= declThreshold) {
    return {
      category: 'CRITICAL',
      priority: 'CRITICAL',
      action: 'IMMEDIATE_CHANGE_REQUIRED'
    };
  }

  if (levelMeters > thresholds.categories.CRITICAL.minDepthMeters) {
    return {
      category: 'CRITICAL',
      priority: 'CRITICAL',
      action: 'IMMEDIATE_CHANGE_REQUIRED'
    };
  }

  if (levelMeters >= thresholds.categories.HIGH.minDepthMeters) {
    return {
      category: 'HIGH',
      priority: 'HIGH',
      action: 'CHANGE_RECOMMENDED'
    };
  }

  return {
    category: 'NORMAL',
    priority: 'LOW',
    action: 'MAINTAIN_OR_OPTIMIZE'
  };
}

module.exports = {
  classifyGroundwater
};
