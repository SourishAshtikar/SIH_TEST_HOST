require('dotenv').config();
const { query, pool } = require('./src/db');

async function assignGeographies() {
  try {
    console.log("Assigning test users to villages & districts...");

    // Village Head -> Gharaunda (Village 1, District 1)
    await query(`
      UPDATE users 
      SET village_id = 1, district_id = 1 
      WHERE email = 'test_village_head@example.com'
    `);
    console.log("✅ Assigned Village Head to Village: Gharaunda, District: Karnal");

    // Auditor -> District 1 (Karnal)
    await query(`
      UPDATE users 
      SET district_id = 1 
      WHERE email = 'test_auditor@ezxample.com'
    `);
    console.log("✅ Assigned Auditor to District: Karnal");

    // Government Employee -> Whole state (Usually null district, but let's assign Karnal just in case)
    await query(`
      UPDATE users 
      SET district_id = 1 
      WHERE email = 'test_government_employee@example.com'
    `);
    console.log("✅ Assigned Government Employee to District: Karnal");

    console.log("🎉 Geographic assignments complete!");
  } catch (err) {
    console.error("Assignment failed:", err);
  } finally {
    await pool.end();
  }
}

assignGeographies();
