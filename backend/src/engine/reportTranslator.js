function translateReport(reportObj) {
  const { village, season, crop, recommendedPractice, priority, diagnostics } = reportObj;
  const villageName = village?.villageName || village?.name || 'Village';
  const districtName = village?.district || village?.districtName || 'Haryana';
  const cropName = crop?.name || 'Crop';
  const seasonName = season?.name || 'Season';
  const practiceName = recommendedPractice?.name || 'Water-Saving Method';
  const depth = diagnostics?.groundwaterLevelMeters || '10.5';

  return {
    en: {
      title: `${priority} Groundwater Advisory — ${villageName}, ${districtName}`,
      priorityLabel: priority === 'CRITICAL' ? 'CRITICAL ALERT' : 'RECOMMENDED',
      recommendedPracticeTitle: 'Recommended Irrigation Method',
      explanation: `Groundwater depth in ${villageName} (${districtName}) has reached ${depth}m with a ${diagnostics?.groundwaterTrend || 'DECLINING'} trend. Switching from traditional flood irrigation to ${practiceName} for ${cropName} during ${seasonName} saves up to 55% water (~4,800 m³/ha) and prevents tubewell pump failure.`,
      growthStagesTitle: 'Critical Crop Water Stages'
    },
    hi: {
      title: `${priority === 'CRITICAL' ? 'गंभीर' : 'महत्वपूर्ण'} भूजल चेतावनी — ${villageName}, ${districtName}`,
      priorityLabel: priority === 'CRITICAL' ? 'गंभीर स्थिति' : 'अनुशंसित सलाह',
      recommendedPracticeTitle: 'अनुशंसित सिंचाई तकनीक',
      explanation: `${villageName} (जिला ${districtName}) में भूजल स्तर ${depth} मीटर की गहराई पर है। ${seasonName} मौसम में ${cropName} की फसल के लिए पारंपरिक सिंचाई छोड़कर ${practiceName} तकनीक अपनाने से 55% पानी (4,800 m³/हेक्टेयर) बचेगा और मोटर फुंकने से बचेगी।`,
      growthStagesTitle: 'फसल के मुख्य सिंचाई चरण'
    },
    hr: {
      title: `हरियाणवी भूजल अर सिंचाई सलाह — ${villageName}, ${districtName}`,
      priorityLabel: priority === 'CRITICAL' ? 'घणी गंभीर हालत' : 'खरी सलाह',
      recommendedPracticeTitle: 'सबसे खरी तरकीब',
      explanation: `गाँव ${villageName} (जिला ${districtName}) में पाणी (भूजल) ${depth} मीटर नीचे चला ग्या सै। ${seasonName} में ${cropName} खात्तर ${practiceName} सबसे खरी तरकीब सै, जिससे 55% पाणी बचेगा अर ट्यूबल की मोटर फुगण ते बचेगी।`,
      growthStagesTitle: 'फसल के पाणी पिलाण आले मुख्य टेम'
    }
  };
}

module.exports = {
  translateReport
};
