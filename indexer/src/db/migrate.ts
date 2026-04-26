import fs from 'fs';
import path from 'path';
import { getPool } from './client';

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM migrations WHERE name = $1', [file]);
    if (rows.length > 0) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
    console.log(`Applied migration: ${file}`);
  }
}

if (require.main === module) {
  require('dotenv').config();
  runMigrations()
    .then(() => { console.log('Migrations complete'); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}
