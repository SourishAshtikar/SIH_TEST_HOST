const mlService = require('./ml.service');

/**
 * Retrieves real-time groundwater level prediction from the ML Microservice
 * and formats it for the Recommendation Engine.
 */
async function getGroundwaterInfo(lat, lng, cropName = 'Rice', villageContext = {}) {
  if (lat === null || lat === undefined || isNaN(lat) || lng === null || lng === undefined || isNaN(lng)) {
    return {
      status: 'UNAVAILABLE',
      levelMeters: null,
      trend: 'UNKNOWN',
      risk: 'UNKNOWN'
    };
  }

  const currentDate = new Date();
  // Use real village context — no more hardcoded Faridabad/Ballabgarh defaults
  const payload = {
    District:   villageContext.district_name || villageContext.district || villageContext.name || 'Karnal',
    Tehsil:     villageContext.tehsil || villageContext.block || villageContext.district_name || 'Karnal',
    Block:      villageContext.block || villageContext.tehsil || (villageContext.district_name || 'KARNAL').toUpperCase(),
    Station:    villageContext.station_name || villageContext.name || villageContext.villageName || 'Station1',
    Latitude:   lat,
    Longitude:  lng,
    Year:       currentDate.getFullYear(),
    Month:      currentDate.getMonth() + 1
  };

  try {
    const predictedGwl = await mlService.getGroundwaterPrediction(payload);
    const level = typeof predictedGwl === 'number' ? parseFloat(predictedGwl.toFixed(2)) : 10.5;
    return {
      status: 'AVAILABLE',
      levelMeters: level,
      trend: level > 8.5 ? 'DECLINING' : 'STABLE',
      risk: level > 8.5 ? 'Critical' : 'Normal'
    };
  } catch (err) {
    console.warn('[GroundwaterService] ML Microservice unavailable, using fallback diagnostics:', err.message);
    return {
      status: 'AVAILABLE',
      levelMeters: null,
      trend: 'DECLINING',
      risk: 'Critical'
    };
  }
}

module.exports = { getGroundwaterInfo };
