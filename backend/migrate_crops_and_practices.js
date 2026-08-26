require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./src/db');

const cropsData = require('./src/data/crops.json');
const practicesData = require('./src/data/irrigationPractices.json');

async function migrateData() {
  try {
    console.log('🚀 Running migration: 014_enhance_crops_and_irrigation_methods.sql...');
    const migrationSql = fs.readFileSync(
      path.join(__dirname, 'database', 'migrations', '014_enhance_crops_and_irrigation_methods.sql'),
      'utf8'
    );
    await query(migrationSql);
    console.log('✅ Schema enhanced successfully.');

    // 1. Migrate Irrigation Practices
    console.log('\n💧 Migrating Irrigation Practices to database...');
    for (let i = 0; i < practicesData.practices.length; i++) {
      const p = practicesData.practices[i];
      const methodId = i + 1;
      await query(`
        INSERT INTO irrigation_methods (
          method_id, code, name, water_efficiency, water_savings_percentage, energy_savings_percentage
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (method_id) DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          water_efficiency = EXCLUDED.water_efficiency,
          water_savings_percentage = EXCLUDED.water_savings_percentage,
          energy_savings_percentage = EXCLUDED.energy_savings_percentage
      `, [
        methodId,
        p.id,
        p.name,
        p.waterEfficiency,
        p.waterSavingsPercentage || 0,
        p.energySavingsPercentage || 0
      ]);
      console.log(`  ✓ Inserted/Updated practice [${methodId}]: ${p.name}`);
    }
    await query(`SELECT setval(pg_get_serial_sequence('irrigation_methods', 'method_id'), (SELECT MAX(method_id) FROM irrigation_methods))`);

    // 2. Migrate Crops
    console.log('\n🌾 Migrating Crops to database...');
    for (const c of cropsData.crops) {
      await query(`
        INSERT INTO crops (
          crop_id, name, water_requirement, season, water_requirement_class,
          priority, suitable_practices, water_saving_practices, critical_irrigation_stages
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (crop_id) DO UPDATE SET
          name = EXCLUDED.name,
          water_requirement = EXCLUDED.water_requirement,
          season = EXCLUDED.season,
          water_requirement_class = EXCLUDED.water_requirement_class,
          priority = EXCLUDED.priority,
          suitable_practices = EXCLUDED.suitable_practices,
          water_saving_practices = EXCLUDED.water_saving_practices,
          critical_irrigation_stages = EXCLUDED.critical_irrigation_stages
      `, [
        c.id,
        c.name,
        c.waterRequirementClass,
        c.season,
        c.waterRequirementClass,
        c.priority,
        JSON.stringify(c.suitablePractices || []),
        JSON.stringify(c.waterSavingPractices || []),
        JSON.stringify(c.criticalIrrigationStages || [])
      ]);
      console.log(`  ✓ Inserted/Updated crop [${c.id}]: ${c.name}`);
    }
    await query(`SELECT setval(pg_get_serial_sequence('crops', 'crop_id'), (SELECT MAX(crop_id) FROM crops))`);

    console.log('\n🎉 Successfully migrated all crops and irrigation practices to PostgreSQL database!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrateData();
