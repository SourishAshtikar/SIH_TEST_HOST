const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { pool } = require('../src/db/index');

async function migrateAndSeed() {
  const client = await pool.connect();
  try {
    console.log('Starting migration and seeding on .env database...');
    
    // 1. Run Migrations
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log('\n--- APPLYING MIGRATIONS ---');
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
    }
    console.log('All migrations executed successfully.');

    // 2. Run Seeds
    const seedsDir = path.join(__dirname, '../database/seeds');
    const seedFiles = fs.readdirSync(seedsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log('\n--- APPLYING SEEDS ---');
    for (const file of seedFiles) {
      const filePath = path.join(seedsDir, file);
      console.log(`Running seed: ${file}`);
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
    }
    console.log('All seeds executed successfully.');

    // 3. Verify Table Row Counts
    console.log('\n--- TABLE SUMMARY ---');
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      const countRes = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
      console.log(`Table '${tableName}': ${countRes.rows[0].count} rows`);
    }

    console.log('\nMigration and seeding complete!');
  } catch (err) {
    console.error('Error during migration/seeding:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateAndSeed();
