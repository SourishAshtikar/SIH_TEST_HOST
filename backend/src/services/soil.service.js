const fs = require('fs');
const path = require('path');

// In-memory cache for district average soil moisture from sm_haryana_2020.csv
let districtMoistureCache = null;

function loadDistrictSoilMoisture() {
  if (districtMoistureCache) return districtMoistureCache;

  const datasetPath = path.join(__dirname, '../../Dataset/sm_haryana_2020.csv');
  districtMoistureCache = {};

  if (fs.existsSync(datasetPath)) {
    try {
      const fileContent = fs.readFileSync(datasetPath, 'utf-8');
      const lines = fileContent.split('\n');
      const districtTotals = {};

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length >= 7) {
          const dist = row[2]?.trim().toUpperCase();
          const moisturePct = parseFloat(row[6]);

          if (dist && !isNaN(moisturePct)) {
            if (!districtTotals[dist]) {
              districtTotals[dist] = { sum: 0, count: 0 };
            }
            districtTotals[dist].sum += moisturePct;
            districtTotals[dist].count += 1;
          }
        }
      }

      for (const [dist, data] of Object.entries(districtTotals)) {
        if (data.count > 0) {
          districtMoistureCache[dist] = parseFloat((data.sum / data.count).toFixed(2));
        }
      }
    } catch (err) {
      console.warn('Warning: Failed to load sm_haryana_2020.csv dataset:', err.message);
    }
  }

  return districtMoistureCache;
}

/**
 * Service for retrieving village-level soil characteristics and historical soil moisture.
 * @param {Object} locationObj 
 * @returns {Promise<Object>} Soil metadata payload
 */
async function getSoilInfo(locationObj) {
  if (!locationObj) {
    return {
      status: 'UNAVAILABLE',
      soilType: null,
      texture: null,
      drainage: null,
      moisturePercentage: null
    };
  }

  const lat = locationObj.latitude;
  const distName = (locationObj.districtName || '').toUpperCase();

  // Load dataset soil moisture
  const moistureMap = loadDistrictSoilMoisture();
  const moisturePct = moistureMap[distName] || 18.5;

  // Haryana soil distribution rule base:
  // North Haryana (Karnal, Kurukshetra, Ambala, Panchkula, Yamunanagar) -> Loamy / Alluvium soil
  // South/West Haryana (Hisar, Sirsa, Bhiwani, Mahendragarh, Palwal, Gurugram, Nuh) -> Sandy / Sandy Loam soil
  let soilType = 'Loamy';
  let texture = 'Medium';
  let drainage = 'Good';

  if (lat !== null && lat < 29.0) {
    soilType = 'Sandy Loam';
    texture = 'Light';
    drainage = 'Excessive';
  } else if (distName && ['PALWAL', 'FARIDABAD', 'GURGAON', 'GURUGRAM', 'MEWATH', 'NUH', 'BHIWANI', 'SIRSA', 'MAHENDRAGARH'].includes(distName)) {
    soilType = 'Sandy';
    texture = 'Coarse';
    drainage = 'Fast';
  }

  return {
    status: 'AVAILABLE',
    soilType,
    texture,
    drainage,
    moisturePercentage: moisturePct
  };
}

module.exports = {
  getSoilInfo
};
