require('dotenv').config();
const app = require('../src/app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  async function check(url, token = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`http://localhost:${port}${url}`, { headers });
    console.log(`${res.status} ${url} ->`, await res.text());
  }

  try {
    // 1. Check health
    await check('/api/health');

    // 2. Login as village head
    const loginRes = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_village_head@example.com', password: 'password123' })
    });
    const loginData = await loginRes.json();
    console.log('Login result:', loginData);
    const token = loginData.data?.token;

    if (token) {
      console.log('\n--- Testing Village Head endpoints ---');
      await check('/api/auth/me', token);
      const farmsRes = await fetch(`http://localhost:${port}/api/farms`, { headers: { 'Authorization': `Bearer ${token}` } });
      const farmsJson = await farmsRes.json();
      console.log('Farms:', farmsJson);
      if (farmsJson.data?.farms?.[0]) {
        const firstFarmId = farmsJson.data.farms[0].farm_id;
        await check(`/api/farms/${firstFarmId}/crop-records`, token);
      }
      await check('/api/audits', token);
      await check('/api/schemes', token);
      await check('/api/agriculture/seasons', token);
      await check('/api/agriculture/crops', token);
      await check('/api/agriculture/irrigation-methods', token);
      await check('/api/reference/recommendation-options', token);

      console.log('\n--- Testing AI Recommendation API with DB crop data ---');
      const recRes = await fetch(`http://localhost:${port}/api/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          villageId: 1,
          cropName: 'Paddy / Rice (धान / जीरी)',
          currentPractice: 'Flood Irrigation (पारंपरिक बहाव)'
        })
      });
      console.log('Recommendation result:', recRes.status, await recRes.json());
      await check('/api/groundwater-assessments/years', token);
      await check('/api/groundwater-assessments?year=2025-2026&scope=district', token);
      await check('/api/groundwater-assessments/details?scope=state&year=2025-2026', token);
      await check('/haryana_districts.geojson');
      await check('/haryana_villages.geojson');
      await check('/api/groundwater/heatmap', token);
    }
  } catch (err) {
    console.error('Error during endpoint check:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
