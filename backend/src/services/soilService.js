const soilConfig = require('../data/soil.json');

async function getSoilInfo(village) {
  if (!village) {
    return {
      soilType: "Loamy Alluvium",
      texture: "Medium",
      drainage: "Good"
    };
  }

  const distName = (village.district || '').trim();

  // Search district in zone mapping
  for (const zone of Object.values(soilConfig.zoneSoilMapping)) {
    if (zone.districts.some(d => d.toLowerCase() === distName.toLowerCase())) {
      return {
        soilType: zone.soilType,
        texture: zone.texture,
        drainage: zone.drainage
      };
    }
  }

  return {
    soilType: "Loamy Alluvium",
    texture: "Medium",
    drainage: "Good"
  };
}

module.exports = {
  getSoilInfo
};
