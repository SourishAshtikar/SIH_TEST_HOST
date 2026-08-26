function classifyRainfall(recentMm, forecastMm) {
  const totalMm = (recentMm || 0) + (forecastMm || 0);

  if (totalMm >= 50.0) {
    return {
      category: 'ABUNDANT',
      description: 'High rainfall region/period'
    };
  } else if (totalMm >= 15.0) {
    return {
      category: 'MODERATE',
      description: 'Moderate rainfall expected'
    };
  } else {
    return {
      category: 'DEFICIENT',
      description: 'Dry spell / deficient rainfall'
    };
  }
}

module.exports = {
  classifyRainfall
};
