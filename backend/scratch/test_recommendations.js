require('dotenv').config();
const { evaluateRecommendation } = require('../src/engine/recommendationEngine');

async function testEngine() {
  const cases = [
    { crop: 'Paddy / Rice (धान / जीरी)', practice: 'Underground Pipeline & AWD (भूमिगत पाइपलाइन)' },
    { crop: 'Paddy / Rice (धान / जीरी)', practice: 'Flood Irrigation (पारंपरिक बहाव)' },
    { crop: 'Cotton (कपास)', practice: 'Pitcher / Pot Irrigation (घड़ा सिंचाई)' },
    { crop: 'Cotton (कपास)', practice: 'Flood Irrigation (पारंपरिक बहाव)' },
    { crop: 'Cotton (कपास)', practice: 'Furrow Irrigation (नाली सिंचाई)' },
    { crop: 'Wheat (गेहूं)', practice: 'Flood Irrigation (पारंपरिक बहाव)' },
    { crop: 'Sugarcane (गन्ना)', practice: 'Flood Irrigation (पारंपरिक बहाव)' },
    { crop: 'Mustard (सरसों)', practice: 'Flood Irrigation (पारंपरिक बहाव)' }
  ];

  for (const c of cases) {
    const res = await evaluateRecommendation({
      village: { village_id: 1, name: 'Gharaunda', latitude: 29.5361, longitude: 76.9694 },
      cropName: c.crop,
      currentPracticeName: c.practice,
      groundwater: { levelMeters: 32.71, trend: 'DECLINING' },
      weather: { rainfallRecentMm: 490 },
      soil: { soilType: 'Loamy Alluvium', texture: 'Medium', drainage: 'Good' },
      assessment: { recharge_bcm: 1.2, extraction_all_uses_bcm: 0.9, rainfall_mm: 490, stage_of_extraction_pct: 88.9 }
    });

    console.log(`\n========================================`);
    console.log(`Crop: ${c.crop}`);
    console.log(`Current: ${c.practice}`);
    console.log(`-> Recommended: ${res.recommendedPractice.name} [Action: ${res.actionRequired}]`);
    console.log(`-> Water Savings %: ${res.waterSavingsPercentage}%`);
    console.log(`-> Conserved Volume: ${res.waterSavedVolumeM3PerHa} m³/ha (Base: ${res.baseWaterRequirementM3Ha} m³/ha)`);
    console.log(`-> Confidence: ${res.confidenceScore}%`);
  }
}

testEngine();
