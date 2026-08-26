/**
 * Service to communicate with the Python ML Model
 */

const getGroundwaterPrediction = async (modelData) => {
  const urlsToTry = [
    process.env.ML_API_URL,
    'http://127.0.0.1:8000/predict',
    'http://localhost:8000/predict'
  ].filter(Boolean);

  const payload = {
    District: modelData.District,
    Tehsil: modelData.Tehsil,
    Block: modelData.Block,
    Station: modelData.Station,
    Latitude: parseFloat(modelData.Latitude),
    Longitude: parseFloat(modelData.Longitude),
    Year: parseInt(modelData.Year, 10),
    Month: parseInt(modelData.Month, 10)
  };

  let lastError = null;

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Python API responded with HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      return data.predicted_gwl_meters;
    } catch (err) {
      lastError = err;
    }
  }

  console.error("Error communicating with Python ML Model:", lastError?.message || lastError);
  const customError = new Error(`Failed to get prediction from ML model (${lastError?.message || 'Connection refused'})`);
  customError.statusCode = 502; // Bad Gateway
  throw customError;
};

module.exports = {
  getGroundwaterPrediction
};
