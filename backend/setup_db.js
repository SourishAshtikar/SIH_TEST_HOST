require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query, pool } = require('./src/db');
const { SYSTEM_ROLES } = require('./src/utils/constants');

async function runSQLFile(filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    await query(sql);
    console.log(`✅ Executed: ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`❌ Error executing ${path.basename(filePath)}:`, error.message);
    throw error;
  }
}

async function runDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    await runSQLFile(path.join(dirPath, file));
  }
}

async function setup() {
  try {
    console.log("Running migrations...");
    await runDirectory(path.join(__dirname, 'database', 'migrations'));
    
    console.log("\nRunning seeds...");
    await runDirectory(path.join(__dirname, 'database', 'seeds'));
    
    console.log("\nCreating test users...");
    const passwordHash = await bcrypt.hash('password123', 10);
    
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
        console.log(`⚠️ User for ${role} already exists -> Email: ${email}`);
      }
    }
    
    console.log("\n🎉 Database setup complete!");
  } catch (err) {
    console.error("Setup failed:", err);
  } finally {
    await pool.end();
  }
}

setup();
