const fs = require('fs');
const path = require('path');

console.log('Reading doc.kml ...');
const kmlPath = path.join(__dirname, 'kmz_extracted', 'doc.kml');
const kmlContent = fs.readFileSync(kmlPath, 'utf8');

console.log('Extracting Placemarks ...');
const placemarkRegex = /<Placemark[\s\S]*?<\/Placemark>/g;
let match;
const features = [];

while ((match = placemarkRegex.exec(kmlContent)) !== null) {
  const pm = match[0];

  const nameM = pm.match(/<name>(.*?)<\/name>/);
  const vName = nameM ? nameM[1].trim() : 'Unknown';

  const dM = pm.match(/<td>district<\/td>\s*<td>(.*?)<\/td>/i);
  const districtName = dM ? dM[1].trim() : '';

  const bM = pm.match(/<td>block<\/td>\s*<td>(.*?)<\/td>/i);
  const blockName = bM ? bM[1].trim() : '';

  const sdM = pm.match(/<td>subdistric<\/td>\s*<td>(.*?)<\/td>/i);
  const subdistrictName = sdM ? sdM[1].trim() : '';

  const coordM = pm.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
  if (!coordM) continue;

  const rawCoordsStr = coordM[1].trim();
  const rawPairs = rawCoordsStr.split(/\s+/);
  const ring = [];

  for (let i = 0; i < rawPairs.length; i++) {
    const parts = rawPairs[i].split(',');
    if (parts.length >= 2) {
      const lng = parseFloat(parseFloat(parts[0]).toFixed(5));
      const lat = parseFloat(parseFloat(parts[1]).toFixed(5));
      if (!isNaN(lng) && !isNaN(lat)) {
        ring.push([lng, lat]);
      }
    }
  }

  if (ring.length >= 3) {
    features.push({
      type: 'Feature',
      properties: {
        NAME: vName,
        DISTRICT: districtName,
        BLOCK: blockName,
        SUBDISTRICT: subdistrictName,
        STATE: 'Haryana'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ring]
      }
    });
  }
}

console.log(`Extracted ${features.length} valid village boundary polygon features.`);

const geojson = {
  type: 'FeatureCollection',
  features: features
};

const outputPath = path.join(__dirname, '..', 'frontend', 'haryana_villages.geojson');
fs.writeFileSync(outputPath, JSON.stringify(geojson));
const stats = fs.statSync(outputPath);
console.log(`Saved frontend/haryana_villages.geojson (${(stats.size / 1024 / 1024).toFixed(2)} MB)!`);
