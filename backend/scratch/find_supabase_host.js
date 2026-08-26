const { Pool } = require('pg');

const projectRef = 'kyvgcntvkojpsxjpbogk';
const password = 'Databaes@54';

const regions = [
  'ap-south-1',
  'ap-southeast-1',
  'us-east-1',
  'us-west-1',
  'eu-central-1',
  'ca-central-1',
  'sa-east-1',
  'ap-northeast-1'
];

async function findWorkingHost() {
  console.log('Testing Supabase pooler regions...');
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    for (const port of [5432, 6543]) {
      for (const user of [`postgres.${projectRef}`, 'postgres']) {
        const pool = new Pool({
          host,
          port,
          database: 'postgres',
          user,
          password,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 4000
        });

        try {
          const res = await pool.query('SELECT current_database(), current_user, NOW()');
          console.log(`\n🎉 WORKING CONNECTION FOUND!`);
          console.log(`Host: ${host}`);
          console.log(`Port: ${port}`);
          console.log(`User: ${user}`);
          console.log(`Result:`, res.rows[0]);
          await pool.end();
          return { host, port, user };
        } catch (err) {
          // silently continue
          await pool.end().catch(() => {});
        }
      }
    }
    console.log(`Region ${region} failed.`);
  }
  console.log('No working pooler region found.');
  return null;
}

findWorkingHost();
