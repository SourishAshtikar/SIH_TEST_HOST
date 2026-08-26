const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument({ margin: 40, size: 'A4' });
const outputPath = path.join(__dirname, '..', 'Recommendation_Engine_Formula_and_Sources.pdf');
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// Primary Palette
const primaryColor = '#0f172a';
const accentColor = '#0284c7';
const secondaryColor = '#334155';

// Title Header
doc.fillColor(primaryColor).fontSize(20).font('Helvetica-Bold').text('Smart Irrigation Advisory & Recommendation Engine', { align: 'center' });
doc.fontSize(12).font('Helvetica-Oblique').fillColor(accentColor).text('Mathematical Formulas, Decision Logic & Dataset Sources Documentation', { align: 'center' });
doc.moveDown(0.8);
doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
doc.moveDown(0.8);

// Section 1: Core Formula
doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('1. Multi-Factor Agronomic Scoring Formula');
doc.moveDown(0.4);
doc.fillColor(secondaryColor).fontSize(10).font('Helvetica').text(
  'For any candidate irrigation practice T in {Drip, Sprinkler, AWD, Furrow, Border, RaisedBed, Pitcher, Flood}, the total agronomic suitability score Score(T) is calculated as:'
);
doc.moveDown(0.5);

// Math Box
doc.rect(40, doc.y, 515, 36).fillAndStroke('#f8fafc', '#cbd5e1');
doc.fillColor('#0369a1').fontSize(11).font('Helvetica-Bold').text(
  'Score(T) = 0.35 * S1(T)  +  0.20 * S2(T)  +  0.20 * S3(T)  +  0.15 * S4(T)  +  0.10 * S5(T)',
  50, doc.y - 26
);
doc.moveDown(1.2);

// Weight Distribution Table
doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('Factor Weighting Breakdown:');
doc.moveDown(0.4);

const tableTop = doc.y;
const rows = [
  ['Weight', 'Agronomic Factor', 'Description & Impact'],
  ['35%', 'S1: Groundwater Stage', 'Aquifer stress (Safe, Semi-Critical, Critical, Over-Exploited)'],
  ['20%', 'S2: Soil Texture & Infiltration', 'Soil water-holding capacity (Coarse, Medium, Fine)'],
  ['20%', 'S3: Crop Water Demand', 'Seasonal evapotranspiration demand (Kc x ET0)'],
  ['15%', 'S4: Rainfall & Weather', 'Observed & forecast precipitation shortfall'],
  ['10%', 'S5: Practice Transition', 'Preference penalty/bonus vs existing farm practice']
];

rows.forEach((row, i) => {
  const y = tableTop + (i * 20);
  if (i === 0) {
    doc.rect(40, y, 515, 18).fill('#e2e8f0');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
  } else {
    doc.fillColor('#334155').font('Helvetica').fontSize(9);
  }
  doc.text(row[0], 48, y + 4, { width: 50 });
  doc.text(row[1], 105, y + 4, { width: 170 });
  doc.text(row[2], 280, y + 4, { width: 270 });
});

doc.y = tableTop + (rows.length * 20) + 12;

// Section 2: AI Confidence Formula
doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('2. Calibrated AI Confidence Score Formula');
doc.moveDown(0.4);
doc.fillColor(secondaryColor).fontSize(10).font('Helvetica').text(
  'Confidence percentage reflects decision certainty based on top-pick score alignment, consensus factor agreement, and runner-up margin separation:'
);
doc.moveDown(0.5);

doc.rect(40, doc.y, 515, 36).fillAndStroke('#f8fafc', '#cbd5e1');
doc.fillColor('#0369a1').fontSize(10).font('Helvetica-Bold').text(
  'Confidence (%) = MIN( 96,  MAX( 72,  (Score_top * 0.90) + (N_agree / 5 * 12) + MIN(0.8 * Margin, 12) ) )',
  50, doc.y - 26
);
doc.moveDown(1.2);

// Section 3: Dynamic Volume Saved
doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('3. Dynamic Water Volume Saved Formula');
doc.moveDown(0.4);
doc.fillColor(secondaryColor).fontSize(10).font('Helvetica').text(
  'Water savings per hectare are calculated dynamically based on published crop seasonal water requirements (ETc):'
);
doc.moveDown(0.4);
doc.fillColor('#0369a1').fontSize(10).font('Helvetica-Bold').text('Volume Saved (m3/ha) = Crop Water Requirement (m3/ha) * ( WaterSavingsPct / 100 )');
doc.moveDown(0.6);

// Benchmark table
doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('Crop Water Savings Benchmarks:');
doc.moveDown(0.3);
const benchTop = doc.y;
const benchRows = [
  ['Crop Species', 'Seasonal Req (m3/ha)', 'Drip Saved (55%)', 'Sprinkler Saved (35%)'],
  ['Paddy / Rice', '12,500 m3/ha', '6,875 m3/ha', '4,375 m3/ha'],
  ['Sugarcane', '18,000 m3/ha', '9,900 m3/ha', '6,300 m3/ha'],
  ['Cotton', '7,000 m3/ha', '3,850 m3/ha', '2,450 m3/ha'],
  ['Wheat', '4,500 m3/ha', '2,475 m3/ha', '1,575 m3/ha'],
  ['Potato / Tomato', '5,500 - 6,000 m3/ha', '3,025 - 3,300 m3/ha', '1,925 - 2,100 m3/ha'],
  ['Mustard / Bajra', '3,000 m3/ha', '1,650 m3/ha', '1,050 m3/ha']
];

benchRows.forEach((row, i) => {
  const y = benchTop + (i * 18);
  if (i === 0) {
    doc.rect(40, y, 515, 16).fill('#e2e8f0');
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
  } else {
    doc.fillColor('#334155').font('Helvetica').fontSize(9);
  }
  doc.text(row[0], 48, y + 3, { width: 130 });
  doc.text(row[1], 185, y + 3, { width: 120 });
  doc.text(row[2], 310, y + 3, { width: 110 });
  doc.text(row[3], 430, y + 3, { width: 120 });
});

doc.y = benchTop + (benchRows.length * 18) + 12;

// Section 4: Data Sources & Citations
doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('4. Official Dataset Sources & Scientific Citations');
doc.moveDown(0.4);

const sources = [
  ['1. Survey of India (SOI)', 'vb_soi_hr.kmz — Official 7,010 Village Boundary Polygons for Haryana.'],
  ['2. Central Ground Water Board (CGWB)', 'Dynamic Groundwater Assessment Reports (1991-2020 & 2023-2024) — Net availability, draft, extraction stage %, DTW.'],
  ['3. Open-Meteo / ECMWF ERA5 & GFS', 'Historical & forecast precipitation, temp, humidity, Penman-Monteith ET0.'],
  ['4. FAO-56 (United Nations)', 'Crop Evapotranspiration guidelines, Kc factors, application efficiency (Drip 90%, Sprinkler 75%, Flood 40%).'],
  ['5. ICAR & CCS HAU Hissar', 'Package of Practices for Haryana Crops, soil texture maps, AWD paddy protocols.'],
  ['6. NASA SMAP & Sentinel-1', '0-15cm Topsoil volumetric moisture dataset for Haryana districts (2018-2025).']
];

sources.forEach(src => {
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9.5).text(src[0]);
  doc.fillColor('#475569').font('Helvetica').fontSize(9).text(src[1]);
  doc.moveDown(0.3);
});

doc.end();

stream.on('finish', () => {
  console.log('Successfully generated Recommendation_Engine_Formula_and_Sources.pdf!');
});
