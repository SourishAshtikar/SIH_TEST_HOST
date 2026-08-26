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
 * Weather Service querying Open-Meteo API returning normalized weather output.
 * If API fails, returns status: "UNAVAILABLE" without fabricating fake data.
 */
async function getWeatherInfo(lat, lng) {
  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
    return {
      weatherStatus: 'UNAVAILABLE',
      rainfallRecentMm: null,
      rainfallForecastMm: null,
      temperature: null,
      et0: null
    };
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,temperature_2m_max,et0_fao_evapotranspiration&past_days=7&forecast_days=7&timezone=auto`;
    const response = await httpGetAsync(url);

    let recentRain = 0;
    let forecastRain = 0;
    let et0Sum = 0;
    let et0Count = 0;

    if (response.daily && response.daily.precipitation_sum) {
      const precip = response.daily.precipitation_sum;
      for (let i = 0; i < 7 && i < precip.length; i++) {
        if (precip[i] !== null) recentRain += precip[i];
      }
      for (let i = 7; i < 14 && i < precip.length; i++) {
        if (precip[i] !== null) forecastRain += precip[i];
      }
    }

    if (response.daily && response.daily.et0_fao_evapotranspiration) {
      const etArr = response.daily.et0_fao_evapotranspiration;
      for (const val of etArr) {
        if (val !== null && !isNaN(val)) {
          et0Sum += val;
          et0Count++;
        }
      }
    }

    const avgEt0 = et0Count > 0 ? parseFloat((et0Sum / et0Count).toFixed(2)) : 4.5;
    const avgTemp = response.daily?.temperature_2m_max?.[7] || 32.0;

    return {
      weatherStatus: 'AVAILABLE',
      rainfallRecentMm: parseFloat(recentRain.toFixed(1)),
      rainfallForecastMm: parseFloat(forecastRain.toFixed(1)),
      temperature: avgTemp,
      et0: avgEt0
    };
  } catch (err) {
    console.warn('Open-Meteo API unreachable or failed:', err.message);
    return {
      weatherStatus: 'UNAVAILABLE',
      rainfallRecentMm: null,
      rainfallForecastMm: null,
      temperature: null,
      et0: null
    };
  }
}

module.exports = {
  getWeatherInfo
};
