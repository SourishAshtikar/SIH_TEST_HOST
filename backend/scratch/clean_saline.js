require('dotenv').config();
const { query, pool } = require('../src/db');

async function run() {
  const r = await query("UPDATE groundwater_assessments SET category = 'Over Exploited' WHERE category = 'Saline'");
  console.log(`Updated ${r.rowCount} Saline records to Over Exploited in database.`);
  pool.end();
}

run().catch(console.error);
