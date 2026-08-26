require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, pool } = require('./src/db');
const { SYSTEM_ROLES } = require('./src/utils/constants');

async function createTestUsers() {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);
    console.log("Creating test users...");

    for (const role of SYSTEM_ROLES) {
      const name = `Test ${role.replace('_', ' ').toLowerCase()}`;
      const email = `test_${role.toLowerCase()}@example.com`;
      
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      
      if (existing.rows.length === 0) {
        await query(
          'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
          [name, email, passwordHash, role]
        );
        console.log(`✅ Created ${role} user -> Email: ${email}, Password: password123`);
      } else {
        console.log(`⚠️ User for ${role} already exists -> Email: ${email}, Password: password123`);
      }
    }
  } catch (error) {
    console.error("Error creating test users:", error);
  } finally {
    await pool.end();
  }
}

createTestUsers();
