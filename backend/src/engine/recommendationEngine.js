const cropsData = require('../data/crops.json');
const practicesData = require('../data/irrigationPractices.json');
const { classifyGroundwater } = require('./groundwaterClassifier');
const { classifyRainfall } = require('./rainfallClassifier');
const { translateReport } = require('./reportTranslator');
const { scoreIrrigationTechniques, generateReasons, TECHNIQUES } = require('./agronomicScorer');

// Map agronomic scorer technique IDs to practice data entries
function resolvePracticeFromTechniqueId(techniqueId) {
  const searchId = (techniqueId || '').toLowerCase();
  let practice = practicesData.practices.find(p => p.id.toLowerCase() === searchId);
  if (practice) return practice;
  practice = practicesData.practices.find(p =>
    p.name.toLowerCase().includes(searchId) || searchId.includes(p.id.toLowerCase())
  );
  return practice || practicesData.practices.find(p => p.id === 'Drip') || practicesData.practices[0];
}

// Baseline crop seasonal water requirements (m³/ha) based on ICAR & FAO-56 agricultural guidelines
const CROP_WATER_REQUIREMENT_M3_HA = {
  'rice': 12500,
  'paddy': 12500,
  'धान': 12500,
  'जीरी': 12500,
  'sugarcane': 18000,
  'गन्ना': 18000,
  'cotton': 7000,
  'कपास': 7000,
  'wheat': 4500,
  'गेहूं': 4500,
  'potato': 5500,
  'आलू': 5500,
  'tomato': 6000,
  'टमाटर': 6000,
  'turmeric': 9000,
  'हल्दी': 9000,
  'mustard': 3000,
  'सरसों': 3000,
  'maize': 5000,
  'मक्का': 5000,
  'sunflower': 5000,
  'सूरजमुखी': 5000,
  'groundnut': 5500,
  'मूंगफली': 5500,
  'onion': 4500,
  'प्याज': 4500,
  'watermelon': 4000,
  'तरबूज': 4000,
  'bajra': 3000,
  'बाजरा': 3000,
  'barley': 3200,
  'जौ': 3200,
  'jowar': 3200,
  'ज्वार': 3200,
  'moong': 2800,
  'मूंग': 2800,
  'gram': 2600,
  'चना': 2600,
  'masoor': 2400,
  'मसूर': 2400,
  'guar': 2500,
  'गवार': 2500,
  'vegetables': 4500,
  'सब्जियां': 4500
};

function getBaseWaterRequirement(crop) {
  const cropStr = ((crop?.name || '') + ' ' + (crop?.crop_name || '')).toLowerCase();
  for (const [key, val] of Object.entries(CROP_WATER_REQUIREMENT_M3_HA)) {
    if (cropStr.includes(key)) {
      return val;
    }
  }
  return 5000;
}

async function evaluateRecommendation(context) {
  const { village, cropName, currentPracticeName, groundwater, weather, soil, assessment } = context;

  // 1. Resolve Crop Record
  const cropStr = (cropName || 'Rice').toLowerCase();
  const crop = cropsData.crops.find(c =>
    c.name.toLowerCase().includes(cropStr) || cropStr.includes(c.name.toLowerCase().split(' ')[0])
  ) || cropsData.crops[0];

  // 2. Classify Groundwater (determines urgency)
  const gwClass = classifyGroundwater(groundwater ? groundwater.levelMeters : null, groundwater ? groundwater.trend : 'UNKNOWN');

  // 3. Classify Rainfall
  const rfClass = classifyRainfall(
    weather ? weather.rainfallRecentMm : null,
    weather ? weather.rainfallForecastMm : null
  );

  // 4. Resolve Current Irrigation Practice
  const currPracticeStr = (currentPracticeName || 'Flood').toLowerCase();
  const currentPractice = practicesData.practices.find(p =>
    p.name.toLowerCase().includes(currPracticeStr) || 
    currPracticeStr.includes(p.id.toLowerCase()) ||
    currPracticeStr.includes(p.name.toLowerCase().split(' ')[0])
  ) || practicesData.practices[0];

  // 5. Compute Stage of Extraction from DB assessment (or estimate from GW level)
  let stagePct = null;
  if (assessment && assessment.extraction_all_uses_bcm && assessment.extractable_resources_bcm) {
    stagePct = (assessment.extraction_all_uses_bcm / assessment.extractable_resources_bcm) * 100;
  } else if (assessment && assessment.recharge_bcm && assessment.extraction_all_uses_bcm) {
    const extractable = assessment.recharge_bcm * 0.91;
    stagePct = (assessment.extraction_all_uses_bcm / extractable) * 100;
  } else if (assessment && assessment.stage_of_extraction_pct) {
    stagePct = Number(assessment.stage_of_extraction_pct);
  }

  // 6. Run Agronomic Scoring Engine
  const scoringResult = scoreIrrigationTechniques({
    stagePct,
    soilTexture: soil?.texture || soil?.soilType || 'Medium',
    drainage: soil?.drainage || 'Moderate',
    cropName: crop.name,
    cropWaterClass: crop.waterRequirementClass || 'Medium',
    rainfallMm: assessment?.rainfall_mm || weather?.rainfallRecentMm || 490,
    currentPracticeId: currentPractice.id,
  });

  const baseWaterReq = getBaseWaterRequirement(crop);
  const currentSavingsPct = Number(currentPractice.waterSavingsPercentage || currentPractice.waterSavingsPct || 0);

  let recommendedTechnique = scoringResult.recommended;
  let bestPractice = resolvePracticeFromTechniqueId(recommendedTechnique.id);
  let recSavingsPct = Number(bestPractice.waterSavingsPercentage || recommendedTechnique.waterSavingsPct || 0);

  // If current practice already equals or exceeds recommended water savings (e.g. Pitcher 60% vs Drip 55%, or user already on Drip 55%),
  // retain current practice as the optimal choice!
  if (currentSavingsPct >= recSavingsPct && currentSavingsPct > 0) {
    bestPractice = currentPractice;
    recSavingsPct = currentSavingsPct;
  }

  const isCurrentBest = bestPractice.id.toLowerCase() === currentPractice.id.toLowerCase() ||
    currentPractice.name.toLowerCase().includes(bestPractice.id.toLowerCase()) ||
    (currentSavingsPct >= recSavingsPct && currentSavingsPct > 0);

  // 7. Determine Action
  let actionRequired;
  if (isCurrentBest) {
    actionRequired = 'MAINTAIN_CURRENT_PRACTICE';
  } else if (gwClass.category === 'CRITICAL' || gwClass.category === 'HIGH' || (stagePct && stagePct >= 85)) {
    actionRequired = 'HIGH_PRIORITY_UPGRADE';
  } else {
    actionRequired = 'UPGRADE_RECOMMENDED';
  }

  // 8. Compute Conserved Volumes
  const grossVolumeSaved = Math.round(baseWaterReq * (recSavingsPct / 100));
  const incrementalSavingsPct = Math.max(0, recSavingsPct - currentSavingsPct);
  const incrementalVolumeSaved = Math.round(baseWaterReq * (incrementalSavingsPct / 100));

  // 9. Generate Reasons
  const reasons = generateReasons({
    recommended: bestPractice,
    stagePct,
    soilTexture: soil?.texture || soil?.soilType,
    drainage: soil?.drainage,
    cropName: crop.name,
    rainfallMm: assessment?.rainfall_mm || weather?.rainfallRecentMm,
    confidenceScore: scoringResult.confidenceScore,
    isCurrentBest,
    currentPracticeName: currentPractice.name
  });

  // 10. Assemble Diagnostics
  const mlAssessment = assessment ? {
    recharge_bcm: assessment.recharge_bcm,
    extraction_bcm: assessment.extraction_all_uses_bcm,
    extractable_bcm: assessment.extractable_resources_bcm,
    stage_of_extraction_pct: stagePct,
    category: assessment.category || gwClass.category,
    rainfall_mm: assessment.rainfall_mm,
  } : null;

  // 11. Ranked technique breakdown with individual volumes
  const allTechniqueScores = scoringResult.ranked.map(r => {
    const p = resolvePracticeFromTechniqueId(r.id);
    const techSavingsPct = Number(p.waterSavingsPercentage || r.waterSavingsPct || 0);
    return {
      id: r.id,
      name: p.name,
      efficiency: p.waterEfficiency || r.waterEfficiency,
      waterSavingsPercentage: techSavingsPct,
      waterSavedVolumeM3PerHa: Math.round(baseWaterReq * (techSavingsPct / 100)),
      score: r.score
    };
  });

  const report = {
    priority: gwClass.priority,
    groundwaterStatus: gwClass.category,
    actionRequired,
    recommendedPractice: bestPractice,
    waterSavingsPercentage: recSavingsPct,
    waterSavedVolumeM3PerHa: grossVolumeSaved,
    estimatedWaterSavedM3PerHa: grossVolumeSaved,
    incrementalSavingsPercentage: incrementalSavingsPct,
    incrementalWaterSavedM3PerHa: incrementalVolumeSaved,
    baseWaterRequirementM3Ha: baseWaterReq,
    energySavedPercentage: bestPractice.energySavingsPercentage || recommendedTechnique.energySavingsPct || 35,
    confidenceScore: scoringResult.confidenceScore,
    aiPowered: true,
    modelSource: 'Agronomic Scoring Engine (FAO-56 + ICAR · 5 weighted factors)',
    village,
    crop,
    currentPractice: currentPractice.name,
    reasons,
    diagnostics: {
      groundwaterLevelMeters: groundwater?.levelMeters,
      groundwaterTrend: groundwater?.trend || 'UNKNOWN',
      groundwaterCategory: gwClass.category,
      weatherStatus: weather?.weatherStatus || 'AVAILABLE',
      rainfallRecentMm: weather?.rainfallRecentMm,
      rainfallForecastMm: weather?.rainfallForecastMm,
      temperature: weather?.temperature,
      et0: weather?.et0,
      soilType: soil?.soilType || 'Loamy Alluvium',
      soilTexture: soil?.texture || 'Medium',
      mlAssessment,
    },
    criticalStages: crop.criticalIrrigationStages,
    allTechniqueScores,
    scoringBreakdown: scoringResult.ranked.slice(0, 3).map(r => ({
      technique: r.id,
      score: Math.round(r.score),
    })),
  };

  report.multilingualReport = translateReport(report);
  return report;
}

module.exports = { evaluateRecommendation };
