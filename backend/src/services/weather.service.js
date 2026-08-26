const http = require('http');
const https = require('https');

function httpGetAsync(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', err => reject(err));
  });
}

/**
 * Service to fetch real-time and 7-day forecast rainfall from Open-Meteo API.
 */
async function getWeatherInfo(lat, lng) {
  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
    return {
      status: 'UNAVAILABLE',
      rainfallRecentMm: null,
      rainfallForecastMm: null,
      temperatureAvg: null
    };
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,temperature_2m_max&past_days=7&forecast_days=7&timezone=auto`;
    const response = await httpGetAsync(url);

    let recentRain = 0;
    let forecastRain = 0;

    if (response.daily && response.daily.precipitation_sum) {
      const precip = response.daily.precipitation_sum;
      // Past 7 days
      for (let i = 0; i < 7 && i < precip.length; i++) {
        if (precip[i] !== null) recentRain += precip[i];
      }
      // Next 7 days
      for (let i = 7; i < 14 && i < precip.length; i++) {
        if (precip[i] !== null) forecastRain += precip[i];
      }
    }

    return {
      status: 'AVAILABLE',
      rainfallRecentMm: parseFloat(recentRain.toFixed(1)),
      rainfallForecastMm: parseFloat(forecastRain.toFixed(1)),
      temperatureAvg: response.daily?.temperature_2m_max?.[7] || 32.5
    };
  } catch (err) {
    console.warn('Open-Meteo Weather API request failed:', err.message);
    return {
      status: 'UNAVAILABLE',
      rainfallRecentMm: null,
      rainfallForecastMm: null,
      temperatureAvg: null
    };
  }
}

module.exports = {
  getWeatherInfo
};
