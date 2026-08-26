const { spawn } = require('child_process');
const path = require('path');

/**
 * Service to execute Python ML inference bridge predict.py for groundwater predictions.
 */
async function getGroundwaterInfo(lat, lng, cropName = 'Rice') {
  return new Promise((resolve) => {
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
      return resolve({
        status: 'UNAVAILABLE',
        levelMeters: null,
        trend: 'UNKNOWN',
        risk: 'UNKNOWN'
      });
    }

    const scriptPath = path.join(__dirname, '../../Model/predict.py');

    const pythonProc = spawn('python3', [
      scriptPath,
      '--lat', lat.toString(),
      '--lng', lng.toString(),
      '--crop', cropName
    ]);

    let stdoutData = '';
    let stderrData = '';

    pythonProc.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProc.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProc.on('close', (code) => {
      if (code !== 0) {
        console.warn(`predict.py exited with code ${code}. Stderr: ${stderrData}`);
        return resolve({
          status: 'UNAVAILABLE',
          levelMeters: null,
          trend: 'UNKNOWN',
          risk: 'UNKNOWN'
        });
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        resolve({
          status: 'AVAILABLE',
          levelMeters: parsed.level ? parseFloat(parsed.level.toFixed(2)) : 10.5,
          trend: parsed.trend || 'DECLINING',
          risk: parsed.risk || 'Critical'
        });
      } catch (err) {
        console.warn('Failed to parse predict.py JSON output:', stdoutData);
        resolve({
          status: 'UNAVAILABLE',
          levelMeters: null,
          trend: 'UNKNOWN',
          risk: 'UNKNOWN'
        });
      }
    });

    pythonProc.on('error', (err) => {
      console.warn('Failed to launch predict.py python process:', err.message);
      resolve({
        status: 'UNAVAILABLE',
        levelMeters: null,
        trend: 'UNKNOWN',
        risk: 'UNKNOWN'
      });
    });
  });
}

module.exports = {
  getGroundwaterInfo
};
