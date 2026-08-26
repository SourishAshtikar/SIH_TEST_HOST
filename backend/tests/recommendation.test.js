const assert = require('assert');
const { evaluateRecommendation } = require('../src/engine/recommendationEngine');
const villageService = require('../src/services/villageService');
const weatherService = require('../src/services/weatherService');

async function runTests() {
  console.log("=== RUNNING AUTOMATED RECOMMENDATION ENGINE TEST SUITE ===");

  // TEST 1: Critical groundwater + declining trend + high-water crop + flood -> Drip
  {
    console.log("Running TEST 1: Critical Groundwater + Flood -> Drip...");
    const res = await evaluateRecommendation({
      village: { lgdCode: "070001", villageName: "Abdullapur", district: "Panchkula" },
      cropName: "Rice",
      currentPracticeName: "Flood",
      groundwater: { levelMeters: 12.5, trend: "DECLINING" },
      weather: { weatherStatus: "AVAILABLE", rainfallRecentMm: 10, rainfallForecastMm: 20 },
      soil: { soilType: "Loamy Alluvium", texture: "Medium" }
    });

    assert.strictEqual(res.groundwaterStatus, "CRITICAL");
    assert.strictEqual(res.recommendedPractice.id, "Drip");
    assert.strictEqual(res.actionRequired, "CHANGE_RECOMMENDED");
    console.log("✅ TEST 1 PASSED: Drip Irrigation prioritized for Critical GW Rice.");
  }

  // TEST 2: High/Critical groundwater + suitable current practice (Drip) -> Maintain Current Practice
  {
    console.log("Running TEST 2: High GW + Suitable Current Practice (Drip) -> Maintain...");
    const res = await evaluateRecommendation({
      village: { lgdCode: "070001", villageName: "Abdullapur", district: "Panchkula" },
      cropName: "Cotton",
      currentPracticeName: "Drip",
      groundwater: { levelMeters: 11.0, trend: "DECLINING" },
      weather: { weatherStatus: "AVAILABLE", rainfallRecentMm: 5, rainfallForecastMm: 15 },
      soil: { soilType: "Loamy Alluvium", texture: "Medium" }
    });

    assert.strictEqual(res.actionRequired, "MAINTAIN_CURRENT_PRACTICE");
    assert.strictEqual(res.recommendedPractice.id, "Drip");
    console.log("✅ TEST 2 PASSED: Maintain current practice recommended (No unnecessary change).");
  }

  // TEST 3: Normal groundwater (Depth < 5.0m) -> No urgent intervention required
  {
    console.log("Running TEST 3: Normal Groundwater -> No Urgent Intervention...");
    const res = await evaluateRecommendation({
      village: { lgdCode: "070001", villageName: "Abdullapur", district: "Panchkula" },
      cropName: "Wheat",
      currentPracticeName: "Flood",
      groundwater: { levelMeters: 3.5, trend: "STABLE" },
      weather: { weatherStatus: "AVAILABLE", rainfallRecentMm: 25, rainfallForecastMm: 30 },
      soil: { soilType: "Loamy Alluvium", texture: "Medium" }
    });

    assert.strictEqual(res.groundwaterStatus, "NORMAL");
    assert.strictEqual(res.actionRequired, "NO_URGENT_CHANGE_REQUIRED");
    console.log("✅ TEST 3 PASSED: Normal groundwater condition requires no urgent change.");
  }

  // TEST 4: Weather API Unavailable -> Handle failure gracefully without fake weather
  {
    console.log("Running TEST 4: Weather API Unavailable...");
    const weatherRes = await weatherService.getWeatherInfo(null, null);
    assert.strictEqual(weatherRes.weatherStatus, "UNAVAILABLE");
    assert.strictEqual(weatherRes.rainfallRecentMm, null);
    console.log("✅ TEST 4 PASSED: Weather API handled gracefully without fake rainfall.");
  }

  // TEST 5: Stable CGWB Village Lookup by LGD Code
  {
    console.log("Running TEST 5: Stable CGWB Village Lookup by LGD Code...");
    const vil = await villageService.getVillageById("070001");
    assert.strictEqual(vil.villageName, "Abdullapur");
    assert.strictEqual(vil.district, "Panchkula");
    console.log("✅ TEST 5 PASSED: LGD Code 070001 (Abdullapur, Panchkula) resolved correctly.");
  }

  console.log("=== ALL 5 AUTOMATED TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch(err => {
  console.error("❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
