/**
 * Agronomic Scoring Engine — Transparent Multi-Factor Irrigation Technique Recommender
 *
 * Replaces the synthetic ML classifier with a defensible, domain-knowledge based
 * weighted scoring system following FAO-56 and ICAR guidelines.
 */

const TECHNIQUES = [
  { id: 'Drip',         name: 'Drip Irrigation (टपक सिंचाई)',                        waterEfficiency: 'Very High',    waterSavingsPct: 55, energySavingsPct: 40 },
  { id: 'Sprinkler',    name: 'Sprinkler Irrigation (फव्वारा सिंचाई)',                  waterEfficiency: 'High',         waterSavingsPct: 35, energySavingsPct: 25 },
  { id: 'AWD',          name: 'Underground Pipeline & AWD (भूमिगत पाइपलाइन)',          waterEfficiency: 'High',         waterSavingsPct: 30, energySavingsPct: 20 },
  { id: 'Furrow',       name: 'Furrow Irrigation (नाली सिंचाई)',                       waterEfficiency: 'Medium-Low',   waterSavingsPct: 15, energySavingsPct: 10 },
  { id: 'Border',       name: 'Border Strip Irrigation (सीमा पट्टी सिंचाई)',          waterEfficiency: 'Medium',       waterSavingsPct: 20, energySavingsPct: 12 },
  { id: 'RaisedBed',    name: 'Raised Bed Planting (उभरी क्यारी सिंचाई)',               waterEfficiency: 'Medium-High',  waterSavingsPct: 30, energySavingsPct: 18 },
  { id: 'Pitcher',      name: 'Pitcher / Pot Irrigation (घड़ा सिंचाई)',                waterEfficiency: 'Very High',    waterSavingsPct: 60, energySavingsPct: 35 },
  { id: 'Flood',        name: 'Flood Irrigation (पारंपरिक बहाव)',                      waterEfficiency: 'Low',          waterSavingsPct:  0, energySavingsPct:  0 },
];

function scoreByGroundwaterStage(id, stage) {
  if (stage === null || stage === undefined) return 50;
  const oe = stage >= 100, cr = stage >= 90, sc = stage >= 70;
  const map = {
    Drip:     oe ? 95 : cr ? 85 : sc ? 70 : 45,
    Pitcher:  oe ? 85 : cr ? 75 : sc ? 60 : 35,
    Sprinkler:oe ? 75 : cr ? 80 : sc ? 75 : 60,
    AWD:      oe ? 80 : cr ? 80 : sc ? 75 : 55,
    RaisedBed:oe ? 60 : cr ? 60 : sc ? 55 : 50,
    Furrow:   oe ? 20 : cr ? 25 : sc ? 35 : 55,
    Border:   oe ? 15 : cr ? 20 : sc ? 30 : 50,
    Flood:    oe ?  5 : cr ?  8 : sc ? 20 : 60,
  };
  return map[id] ?? 50;
}

function scoreBySoilTexture(id, soilTexture, drainage) {
  const t = (soilTexture || '').toLowerCase();
  const d = (drainage || '').toLowerCase();
  const isCoarse = t.includes('coarse') || t.includes('sandy') || t.includes('light') || d.includes('excessive');
  const isFine   = t.includes('fine')   || t.includes('clay')  || t.includes('heavy');
  const isMedium = !isCoarse && !isFine;
  const map = {
    Drip:     isCoarse ? 70 : isMedium ? 90 : 80,
    Pitcher:  isCoarse ? 60 : isMedium ? 85 : 70,
    Sprinkler:isCoarse ? 90 : isMedium ? 80 : 60,
    AWD:      isCoarse ? 45 : isMedium ? 75 : 85,
    RaisedBed:isCoarse ? 55 : isMedium ? 70 : 65,
    Furrow:   isCoarse ? 35 : isMedium ? 60 : 65,
    Border:   isCoarse ? 30 : isMedium ? 55 : 60,
    Flood:    isCoarse ? 20 : isMedium ? 50 : 55,
  };
  return map[id] ?? 50;
}

function scoreByCropSuitability(id, cropName, cropWaterClass) {
  const cName = (cropName || '').toLowerCase();
  const cClass = (cropWaterClass || '').toLowerCase();

  // Rice / Paddy is specially optimized for AWD & Pipelines
  if (cName.includes('rice') || cName.includes('paddy') || cName.includes('धान') || cName.includes('जीरी')) {
    const map = { AWD: 98, Drip: 65, Sprinkler: 30, RaisedBed: 40, Furrow: 30, Border: 35, Pitcher: 20, Flood: 40 };
    return map[id] ?? 50;
  }

  // Row / Orchard / High cash crops (Cotton, Sugarcane, Potato, Tomato, Turmeric, Fruit)
  if (cName.includes('cotton') || cName.includes('sugarcane') || cName.includes('potato') || cName.includes('tomato') || cName.includes('turmeric') || cName.includes('कपास') || cName.includes('गन्ना') || cName.includes('आलू') || cName.includes('हल्दी')) {
    const map = { Drip: 96, Sprinkler: 65, Furrow: 60, RaisedBed: 65, Pitcher: 70, AWD: 30, Border: 45, Flood: 25 };
    return map[id] ?? 50;
  }

  // Broad-acre cereal and oilseed crops (Wheat, Mustard, Barley, Gram, Bajra)
  if (cName.includes('wheat') || cName.includes('mustard') || cName.includes('barley') || cName.includes('gram') || cName.includes('bajra') || cName.includes('गेहूं') || cName.includes('सरसों') || cName.includes('चना') || cName.includes('बाजरा')) {
    const map = { Sprinkler: 95, RaisedBed: 75, Border: 65, Drip: 70, Furrow: 60, AWD: 35, Pitcher: 30, Flood: 30 };
    return map[id] ?? 50;
  }

  // Generic water class mapping
  const isVH = cClass.includes('very high');
  const isH  = cClass.includes('high') && !isVH;
  const isL  = cClass.includes('low') && !cClass.includes('medium');
  const isMH = cClass.includes('medium-high') || cClass.includes('medium high');

  const map = {
    Drip:     isVH ? 80 : isH ? 92 : isMH ? 88 : isL ? 70 : 80,
    AWD:      isVH ? 95 : isH ? 50 : isMH ? 40 : isL ? 30 : 35,
    Pitcher:  isVH ? 50 : isH ? 70 : isMH ? 75 : isL ? 70 : 65,
    Sprinkler:isVH ? 40 : isH ? 75 : isMH ? 80 : isL ? 88 : 82,
    RaisedBed:isVH ? 40 : isH ? 60 : isMH ? 65 : isL ? 65 : 60,
    Furrow:   isVH ? 35 : isH ? 50 : isMH ? 55 : isL ? 60 : 55,
    Border:   isVH ? 30 : isH ? 45 : isMH ? 50 : isL ? 55 : 50,
    Flood:    isVH ? 50 : isH ? 30 : isMH ? 25 : isL ? 35 : 35,
  };
  return map[id] ?? 50;
}

function scoreByRainfall(id, rainfallMm) {
  const r = rainfallMm || 600;
  const low = r < 500, mod = r >= 500 && r < 900, high = r >= 900;
  const map = {
    Drip:     low ? 95 : mod ? 80 : 65,
    Pitcher:  low ? 85 : mod ? 70 : 55,
    Sprinkler:low ? 75 : mod ? 85 : 80,
    AWD:      low ? 65 : mod ? 70 : 75,
    RaisedBed:low ? 60 : mod ? 65 : 65,
    Furrow:   low ? 30 : mod ? 50 : 65,
    Border:   low ? 25 : mod ? 45 : 60,
    Flood:    low ? 10 : mod ? 35 : 60,
  };
  return map[id] ?? 50;
}

function scoreByCurrentPractice(id, currentId) {
  const curr = (currentId || '').toLowerCase();
  const target = (id || '').toLowerCase();
  
  if (target === curr || curr.includes(target)) return 75;
  if (curr.includes('flood') && target !== 'flood') return 88;
  if ((curr.includes('awd') || curr.includes('pipeline')) && target === 'awd') return 92;
  if (curr.includes('drip') && target === 'drip') return 95;
  if (curr.includes('sprinkler') && target === 'sprinkler') return 95;
  return 60;
}

function scoreIrrigationTechniques({ stagePct, soilTexture, drainage, cropName, cropWaterClass, rainfallMm, currentPracticeId }) {
  const W = { stage: 0.30, soil: 0.20, crop: 0.25, rain: 0.15, current: 0.10 };

  const results = TECHNIQUES.map(t => {
    const s1 = scoreByGroundwaterStage(t.id, stagePct);
    const s2 = scoreBySoilTexture(t.id, soilTexture, drainage);
    const s3 = scoreByCropSuitability(t.id, cropName, cropWaterClass);
    const s4 = scoreByRainfall(t.id, rainfallMm);
    const s5 = scoreByCurrentPractice(t.id, currentPracticeId);
    const total = s1 * W.stage + s2 * W.soil + s3 * W.crop + s4 * W.rain + s5 * W.current;
    return { ...t, score: Math.round(total), factors: { stage: s1, soil: s2, crop: s3, rain: s4, current: s5 } };
  });

  results.sort((a, b) => b.score - a.score);
  const top = results[0];
  const second = results[1];

  const factorAgreements = Object.values(top.factors).filter(v => v >= 65).length;
  const margin = top.score - second.score;

  const baseConf = top.score * 0.90;
  const agreementBonus = (factorAgreements / 5) * 10;
  const marginBonus = Math.min(margin * 0.8, 10);
  const rawConf = baseConf + agreementBonus + marginBonus;
  const confidenceScore = Math.min(Math.max(Math.round(rawConf), 75), 96);

  return { ranked: results, recommended: top, confidenceScore, factorAgreements, totalFactors: 5 };
}

function generateReasons({ recommended, stagePct, soilTexture, drainage, cropName, rainfallMm, confidenceScore, isCurrentBest, currentPracticeName }) {
  const id = recommended.id;
  const gwStatus = stagePct >= 100 ? 'OVER EXPLOITED' : stagePct >= 90 ? 'CRITICAL' : stagePct >= 70 ? 'SEMI-CRITICAL' : 'SAFE';
  const reasons = [];

  reasons.push(`Agronomic scoring engine rated ${confidenceScore}% confidence based on 5 weighted factors: crop agronomy (25%), groundwater stage (30%), soil texture (20%), rainfall deficit (15%), current practice (10%).`);

  if (isCurrentBest) {
    reasons.push(`Current practice (${currentPracticeName || recommended.name}) is already an optimal, high-efficiency technique for ${cropName || 'this crop'}. Conserves maximum water volume compared to conventional flood irrigation.`);
  }

  if (stagePct !== null && stagePct !== undefined) {
    reasons.push(`Groundwater Stage of Extraction: ${stagePct.toFixed(1)}% — status ${gwStatus}. ${stagePct >= 90 ? 'Critical extraction level warrants highest efficiency micro-irrigation systems.' : stagePct >= 70 ? 'Semi-critical extraction requires water-efficient irrigation adoption.' : 'Safe extraction allows standard water management practices.'}`);
  }

  if (id === 'Drip') {
    reasons.push(`Drip Irrigation delivers pressurized water directly at the plant root zone, eliminating evaporation and surface runoff. Saves up to ${recommended.waterSavingsPct || recommended.waterSavingsPercentage}% water and reduces pumping electricity.`);
  } else if (id === 'AWD') {
    reasons.push(`Underground Pipeline & Alternate Wetting & Drying (AWD) is the premier ICAR recommendation for ${cropName || 'Paddy'}: reduces water intake by ~30% while preserving maximum grain yield.`);
  } else if (id === 'Sprinkler') {
    reasons.push(`Sprinkler Irrigation provides uniform overhead precipitation ideal for ${cropName || 'field crops'} on ${soilTexture || 'medium'} soils, saving ${recommended.waterSavingsPct || recommended.waterSavingsPercentage}% water with balanced distribution.`);
  } else if (id === 'RaisedBed') {
    reasons.push(`Raised Bed Planting improves root aeration and minimizes waterlogging, saving ${recommended.waterSavingsPct || recommended.waterSavingsPercentage}% irrigation water through optimized furrow geometry.`);
  } else if (id === 'Pitcher') {
    reasons.push(`Pitcher/Pot Irrigation provides steady sub-surface root moisture, saving up to ${recommended.waterSavingsPct || recommended.waterSavingsPercentage}% water for high-efficiency small plots.`);
  } else if (id === 'Furrow') {
    reasons.push(`Furrow Irrigation directs water strictly along planting ridges, conserving ${recommended.waterSavingsPct || recommended.waterSavingsPercentage}% water compared to traditional flood irrigation.`);
  } else if (id === 'Border') {
    reasons.push(`Border Strip Irrigation allows controlled uniform flow along graded strips, saving ${recommended.waterSavingsPct || recommended.waterSavingsPercentage}% water over uncontrolled flooding.`);
  }

  if (soilTexture) {
    const isCoarse = (soilTexture + (drainage || '')).toLowerCase().match(/coarse|sandy|light|excessive/);
    reasons.push(`Soil profile (${soilTexture}${drainage ? ', ' + drainage + ' drainage' : ''}) ${isCoarse ? 'requires pressurized systems to avoid deep percolation loss on porous soil.' : 'is well-suited to the recommended technique.'}`);
  }

  if (rainfallMm !== null && rainfallMm !== undefined) {
    const rLabel = rainfallMm < 500 ? 'deficient' : rainfallMm < 900 ? 'moderate' : 'adequate';
    reasons.push(`Annual rainfall of ${Math.round(rainfallMm)} mm is ${rLabel} — ${rainfallMm < 700 ? 'irrigation scheduling must maximize root-zone moisture conservation.' : 'irrigation effectively supplements seasonal monsoon rainfall.'}`);
  }

  return reasons;
}

module.exports = { scoreIrrigationTechniques, generateReasons, TECHNIQUES };
