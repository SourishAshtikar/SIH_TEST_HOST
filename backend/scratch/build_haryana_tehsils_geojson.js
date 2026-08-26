const fs = require('fs');
const { query } = require('../src/db');

async function buildTehsilGeoJSON() {
  const districtGeoJSON = JSON.parse(fs.readFileSync('frontend/haryana_districts.geojson', 'utf8'));
  const res = await query('SELECT v.village_id, v.name AS village_name, v.latitude, v.longitude, d.name AS district_name FROM villages v JOIN districts d ON v.district_id = d.district_id');
  const villages = res.rows;

  const distVillages = {};
  villages.forEach(v => {
    const dKey = v.district_name.toLowerCase().trim();
    if (!distVillages[dKey]) distVillages[dKey] = [];
    distVillages[dKey].push(v);
  });

  const tehsilFeatures = [];

  districtGeoJSON.features.forEach(distFeat => {
    const dName = distFeat.properties.NAME_2.toLowerCase().trim();
    const vList = distVillages[dName] || [];

    if (vList.length === 0) return;

    const isMulti = distFeat.geometry.type === 'MultiPolygon';
    const rawCoords = isMulti ? distFeat.geometry.coordinates[0][0] : distFeat.geometry.coordinates[0];

    let minLng = 180, maxLng = -180, minLat = 90, maxLat = -90;
    rawCoords.forEach(c => {
      if (c[0] < minLng) minLng = c[0];
      if (c[0] > maxLng) maxLng = c[0];
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
    });

    if (vList.length === 1) {
      const v = vList[0];
      tehsilFeatures.push({
        type: 'Feature',
        properties: {
          TEHSIL_ID: v.village_id,
          TEHSIL_NAME: v.village_name,
          DISTRICT_NAME: distFeat.properties.NAME_2,
          STATE_NAME: 'Haryana'
        },
        geometry: distFeat.geometry
      });
    } else {
      vList.sort((a, b) => (a.latitude + a.longitude) - (b.latitude + b.longitude));
      const N = vList.length;

      vList.forEach((v, idx) => {
        const latRatioStart = idx / N;
        const latRatioEnd = (idx + 1) / N;

        const pMinLat = minLat + (maxLat - minLat) * latRatioStart;
        const pMaxLat = minLat + (maxLat - minLat) * latRatioEnd;

        const subBox = [
          [minLng, pMinLat],
          [maxLng, pMinLat],
          [maxLng, pMaxLat],
          [minLng, pMaxLat],
          [minLng, pMinLat]
        ];

        tehsilFeatures.push({
          type: 'Feature',
          properties: {
            TEHSIL_ID: v.village_id,
            TEHSIL_NAME: v.village_name,
            DISTRICT_NAME: distFeat.properties.NAME_2,
            STATE_NAME: 'Haryana'
          },
          geometry: {
            type: 'Polygon',
            coordinates: [subBox]
          }
        });
      });
    }
  });

  const tehsilGeoJSON = {
    type: 'FeatureCollection',
    features: tehsilFeatures
  };

  fs.writeFileSync('frontend/haryana_tehsils.geojson', JSON.stringify(tehsilGeoJSON, null, 2));
  console.log('Successfully created frontend/haryana_tehsils.geojson with ' + tehsilFeatures.length + ' Tehsil features!');
  process.exit(0);
}

buildTehsilGeoJSON().catch(e => { console.error(e); process.exit(1); });
