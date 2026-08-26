const fs = require('fs');
const path = require('path');

try {
  console.log('Reading india_district.geojson...');
  const geojsonPath = path.join(__dirname, '../Dataset/india_district.geojson');
  const rawData = fs.readFileSync(geojsonPath, 'utf8');
  const geojsonData = JSON.parse(rawData);

  console.log('Filtering features for Haryana...');
  const haryanaFeatures = geojsonData.features.filter(f => f.properties.NAME_1 === 'Haryana');

  // Normalize district names to match database names
  const nameMapping = {
    'Gurgaon': 'Gurugram',
    'Sonepat': 'Sonipat',
    'Yamuna Nagar': 'Yamunanagar'
  };

  haryanaFeatures.forEach(f => {
    const origName = f.properties.NAME_2;
    if (nameMapping[origName]) {
      f.properties.NAME_2 = nameMapping[origName];
    }
  });

  const filteredGeoJSON = {
    type: 'FeatureCollection',
    features: haryanaFeatures
  };

  const outputPath = path.join(__dirname, '../frontend/haryana_districts.geojson');
  fs.writeFileSync(outputPath, JSON.stringify(filteredGeoJSON, null, 2), 'utf8');
  
  console.log(`Success! Saved ${haryanaFeatures.length} Haryana districts to ${outputPath}`);
} catch (error) {
  console.error('Error filtering GeoJSON:', error);
}
