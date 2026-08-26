const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { SYSTEM_ROLES } = require('../utils/constants');

async function runSQLFile(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  await query(sql);
}

async function runDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    await runSQLFile(path.join(dirPath, file));
  }
}

async function ensureDatabaseInitialized() {
  try {
    const checkTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      )
    `);

    if (!checkTable.rows[0].exists) {
      console.log('⚡ Initializing database schema (auto-running migrations and seeds)...');
      
      const dbDir = path.join(__dirname, '../../database');
      await runDirectory(path.join(dbDir, 'migrations'));
      await runDirectory(path.join(dbDir, 'seeds'));

      const passwordHash = await bcrypt.hash('password123', 10);
      for (const role of SYSTEM_ROLES) {
        const name = `Test ${role.replace('_', ' ').toLowerCase()}`;
        const email = `test_${role.toLowerCase()}@example.com`;
        
        await query(
          `INSERT INTO users (name, email, password_hash, role, district_id, village_id) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           ON CONFLICT (email) DO NOTHING`,
          [
            name, 
            email, 
            passwordHash, 
            role, 
            role === 'ADMIN' ? null : 1, 
            role === 'VILLAGE_HEAD' ? 1 : null
          ]
        );
      }
      console.log('✅ Database initialization and test seed complete.');
    }
  } catch (error) {
    console.warn('⚠️ Auto-migration check warning:', error.message);
  }
}

module.exports = {
  ensureDatabaseInitialized
};
