const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

class MlRechargeService {
  /**
   * Recommend water conservation techniques using the trained classifier.
   * @param {Object} params
   * @param {number} params.recharge_bcm
   * @param {number} params.extraction_bcm
   * @param {string} params.soil_texture
   * @param {string} params.crop_requirement
   * @param {number} params.annual_rainfall
   * @returns {Promise<Object|null>} The ML recommendation payload or null on failure
   */
  async recommendTechnique(params) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000); // 3s timeout
    
    try {
      const response = await fetch(`${FASTAPI_URL}/recommend-technique`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recharge_bcm: parseFloat(params.recharge_bcm) || 1.0,
          extraction_bcm: parseFloat(params.extraction_bcm) || 0.8,
          soil_texture: params.soil_texture || 'Medium',
          crop_requirement: params.crop_requirement || 'Medium',
          annual_rainfall: parseFloat(params.annual_rainfall) || 600.0
        }),
        signal: controller.signal
      });
      
      clearTimeout(id);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          return {
            recommendedPractice: data.recommended_practice,
            confidence: data.confidence_score,
            reasons: data.reasons
          };
        }
      }
      return null;
    } catch (error) {
      clearTimeout(id);
      console.warn(`[MlRechargeService] FastAPI connection failed: ${error.message}. Falling back to rule scorer.`);
      return null;
    }
  }
}

module.exports = new MlRechargeService();
