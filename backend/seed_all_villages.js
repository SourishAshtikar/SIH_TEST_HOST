require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./src/db');
const villagesData = require('./src/data/villages.json');

async function seedAllVillages() {
  try {
    console.log("🌱 Seeding all Haryana districts and villages into PostgreSQL...");

    // 1. Ensure State Haryana exists
    const stateRes = await query(`
      INSERT INTO states (state_id, name)
      VALUES (1, 'Haryana')
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING state_id;
    `);
    const stateId = stateRes.rows[0].state_id;

    // 2. Extract and insert unique districts
    const uniqueDistricts = [...new Set(villagesData.map(v => v.district).filter(Boolean))].sort();
    const districtMap = {};

    for (const distName of uniqueDistricts) {
      const distRes = await query(`
        INSERT INTO districts (name, state_id)
        VALUES ($1, $2)
        ON CONFLICT (name, state_id) DO UPDATE SET name = EXCLUDED.name
        RETURNING district_id;
      `, [distName, stateId]);
      districtMap[distName.toLowerCase()] = distRes.rows[0].district_id;
    }
    console.log(`✅ Upserted ${uniqueDistricts.length} Haryana districts into database.`);

    // 3. Upsert all villages with full ML metadata
    let insertedCount = 0;
    for (const v of villagesData) {
      const distId = districtMap[v.district?.toLowerCase()] || 1;
      
      await query(`
        INSERT INTO villages (name, district_id, lgd_code, tehsil, block, station_name, latitude, longitude)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (name, district_id) DO UPDATE SET
          lgd_code = EXCLUDED.lgd_code,
          tehsil = EXCLUDED.tehsil,
          block = EXCLUDED.block,
          station_name = EXCLUDED.station_name,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude;
      `, [
        v.villageName,
        distId,
        v.lgdCode,
        v.tehsil || null,
        v.block || null,
        v.stationName || v.villageName,
        v.latitude ? parseFloat(v.latitude) : null,
        v.longitude ? parseFloat(v.longitude) : null
      ]);
      insertedCount++;
    }
    console.log(`✅ Upserted ${insertedCount} villages with full geospatial and ML fields.`);

    // Generate comprehensive 001_geography_seed.sql
    const distQuery = await query(`SELECT district_id, name FROM districts ORDER BY district_id`);
    const villQuery = await query(`SELECT village_id, name, district_id, lgd_code, tehsil, block, station_name, latitude, longitude FROM villages ORDER BY village_id`);

    let seedSql = `-- Seed: 001_geography_seed.sql\n-- Description: Comprehensive Haryana geographic master data (Districts & Villages with ML parameters)\n\n`;
    seedSql += `INSERT INTO states (state_id, name)\nVALUES (1, 'Haryana')\nON CONFLICT (state_id) DO UPDATE SET name = EXCLUDED.name;\n\n`;

    seedSql += `-- Districts\nINSERT INTO districts (district_id, name, state_id)\nVALUES\n`;
    seedSql += distQuery.rows.map(d => `    (${d.district_id}, '${d.name.replace(/'/g, "''")}', 1)`).join(',\n');
    seedSql += `\nON CONFLICT (district_id) DO UPDATE SET name = EXCLUDED.name, state_id = EXCLUDED.state_id;\n\n`;

    seedSql += `-- Villages\nINSERT INTO villages (village_id, name, district_id, lgd_code, tehsil, block, station_name, latitude, longitude)\nVALUES\n`;
    seedSql += villQuery.rows.map(v => {
      const tehsil = v.tehsil ? `'${v.tehsil.replace(/'/g, "''")}'` : 'NULL';
      const block = v.block ? `'${v.block.replace(/'/g, "''")}'` : 'NULL';
      const station = v.station_name ? `'${v.station_name.replace(/'/g, "''")}'` : 'NULL';
      const lgd = v.lgd_code ? `'${v.lgd_code}'` : 'NULL';
      const lat = v.latitude !== null ? v.latitude : 'NULL';
      const lon = v.longitude !== null ? v.longitude : 'NULL';
      return `    (${v.village_id}, '${v.name.replace(/'/g, "''")}', ${v.district_id}, ${lgd}, ${tehsil}, ${block}, ${station}, ${lat}, ${lon})`;
    }).join(',\n');

    seedSql += `\nON CONFLICT (village_id) DO UPDATE SET \n    name = EXCLUDED.name,\n    district_id = EXCLUDED.district_id,\n    lgd_code = EXCLUDED.lgd_code,\n    tehsil = EXCLUDED.tehsil,\n    block = EXCLUDED.block,\n    station_name = EXCLUDED.station_name,\n    latitude = EXCLUDED.latitude,\n    longitude = EXCLUDED.longitude;\n\n`;
    seedSql += `SELECT setval(pg_get_serial_sequence('states', 'state_id'), COALESCE(MAX(state_id), 1)) FROM states;\n`;
    seedSql += `SELECT setval(pg_get_serial_sequence('districts', 'district_id'), COALESCE(MAX(district_id), 1)) FROM districts;\n`;
    seedSql += `SELECT setval(pg_get_serial_sequence('villages', 'village_id'), COALESCE(MAX(village_id), 1)) FROM villages;\n`;

    fs.writeFileSync(path.join(__dirname, 'database', 'seeds', '001_geography_seed.sql'), seedSql, 'utf8');
    console.log("✅ Updated database/seeds/001_geography_seed.sql with all master records.");

  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await pool.end();
  }
}

seedAllVillages();
