export const DEFAULT_RECOMMENDATION_OPTIONS = {
  crops: [
    { id: 1, name: 'Paddy / Rice (धान / जीरी)', season: 'Kharif', waterRequirementClass: 'Very High' },
    { id: 2, name: 'Cotton (कपास)', season: 'Kharif', waterRequirementClass: 'High' },
    { id: 3, name: 'Bajra / Pearl Millet (बाजरा)', season: 'Kharif', waterRequirementClass: 'Low-Medium' },
    { id: 4, name: 'Maize (मक्का)', season: 'Kharif', waterRequirementClass: 'Medium' },
    { id: 5, name: 'Guar / Cluster Bean (गवार)', season: 'Kharif', waterRequirementClass: 'Low-Medium' },
    { id: 6, name: 'Sugarcane (गन्ना)', season: 'Kharif', waterRequirementClass: 'Very High' },
    { id: 7, name: 'Wheat (गेहूं)', season: 'Rabi', waterRequirementClass: 'High' },
    { id: 8, name: 'Mustard (सरसों)', season: 'Rabi', waterRequirementClass: 'Low-Medium' },
    { id: 9, name: 'Barley (जौ)', season: 'Rabi', waterRequirementClass: 'Medium' },
    { id: 10, name: 'Gram / Chickpea (चना)', season: 'Rabi', waterRequirementClass: 'Low-Medium' },
    { id: 11, name: 'Potato (आलू)', season: 'Rabi', waterRequirementClass: 'Medium-High' },
    { id: 12, name: 'Moong / Green Gram (मूंग)', season: 'Zaid', waterRequirementClass: 'Low-Medium' },
    { id: 13, name: 'Summer Vegetables (सब्जियां)', season: 'Zaid', waterRequirementClass: 'Medium' },
    { id: 14, name: 'Sunflower (सूरजमुखी)', season: 'Kharif / Rabi', waterRequirementClass: 'Medium' },
    { id: 15, name: 'Jowar / Sorghum (ज्वार)', season: 'Kharif', waterRequirementClass: 'Low-Medium' },
    { id: 16, name: 'Groundnut (मूंगफली)', season: 'Kharif', waterRequirementClass: 'Medium' },
    { id: 17, name: 'Masoor / Lentil (मसूर)', season: 'Rabi', waterRequirementClass: 'Low' },
    { id: 18, name: 'Turmeric (हल्दी)', season: 'Kharif', waterRequirementClass: 'Medium-High' },
    { id: 19, name: 'Onion (प्याज)', season: 'Rabi / Zaid', waterRequirementClass: 'Medium' },
    { id: 20, name: 'Tomato (टमाटर)', season: 'Zaid', waterRequirementClass: 'Medium-High' },
    { id: 21, name: 'Watermelon (तरबूज)', season: 'Zaid', waterRequirementClass: 'Medium' }
  ],
  irrigationPractices: [
    { id: 'Flood', name: 'Flood Irrigation (पारंपरिक बहाव)', waterEfficiency: 'Low', waterSavingsPercentage: 0 },
    { id: 'Furrow', name: 'Furrow Irrigation (नाली सिंचाई)', waterEfficiency: 'Medium-Low', waterSavingsPercentage: 15 },
    { id: 'Sprinkler', name: 'Sprinkler Irrigation (फव्वारा सिंचाई)', waterEfficiency: 'High', waterSavingsPercentage: 35 },
    { id: 'Drip', name: 'Drip Irrigation (टपक सिंचाई)', waterEfficiency: 'Very High', waterSavingsPercentage: 55 },
    { id: 'Underground Pipeline & AWD', name: 'Underground Pipeline & AWD (भूमिगत पाइपलाइन)', waterEfficiency: 'High', waterSavingsPercentage: 30 },
    { id: 'Border', name: 'Border Strip Irrigation (सीमा पट्टी सिंचाई)', waterEfficiency: 'Medium', waterSavingsPercentage: 20 },
    { id: 'RaisedBed', name: 'Raised Bed Planting (उभरी क्यारी सिंचाई)', waterEfficiency: 'Medium-High', waterSavingsPercentage: 30 },
    { id: 'Pitcher', name: 'Pitcher / Pot Irrigation (घड़ा सिंचाई)', waterEfficiency: 'Very High', waterSavingsPercentage: 60 }
  ]
}
