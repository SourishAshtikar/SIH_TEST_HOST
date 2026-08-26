require('dotenv').config();
const { Pool } = require('pg');

async function testBoth() {
  for (const port of [6543, 5432]) {
    console.log('Trying port', port);
    const p = new Pool({
      host: process.env.DB_HOST,
      port,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });
    try {
      const r = await p.query('SELECT current_database(), current_user, NOW()');
      console.log('SUCCESS ON PORT ' + port + ':', r.rows[0]);
      await p.end();
      return port;
    } catch(e) {
      console.log('FAIL ON PORT ' + port + ':', e.message);
      await p.end();
    }
  }
}

testBoth();
