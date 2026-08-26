const rulesConfig = require('../config/recommendationRules.json');

function scorePractice(candidateMethod, crop, soil, rainfall, groundwaterCategory) {
  let score = 0;
  const weights = rulesConfig.scoringWeights || {
    waterSavingCapability: 40,
    soilCompatibility: 30,
    cropSuitability: 20,
    rainfallFactor: 10
  };

  const methodName = (candidateMethod.name || '').toLowerCase();

  // 1. Water Saving Capability
  if (methodName.includes('drip')) {
    score += weights.waterSavingCapability;
  } else if (methodName.includes('sprinkler')) {
    score += weights.waterSavingCapability * 0.75;
  } else if (methodName.includes('flood')) {
    score += weights.waterSavingCapability * 0.1;
  }

  // 2. Soil Compatibility
  if (soil && soil.texture === 'Coarse' && methodName.includes('flood')) {
    score += 0; // Heavy percolation loss on sandy soil
  } else {
    score += weights.soilCompatibility;
  }

  // 3. Crop Suitability
  if (crop && crop.suitableIrrigationPractices && crop.suitableIrrigationPractices.includes(candidateMethod.id)) {
    score += weights.cropSuitability;
  } else {
    score += weights.cropSuitability * 0.5;
  }

  // 4. Rainfall Factor
  if (rainfall && rainfall.category === 'DEFICIENT' && methodName.includes('drip')) {
    score += weights.rainfallFactor;
  } else {
    score += weights.rainfallFactor * 0.5;
  }

  return Math.round(score);
}

module.exports = {
  scorePractice
};
