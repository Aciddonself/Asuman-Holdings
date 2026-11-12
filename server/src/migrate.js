import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8');

if (!process.env.DATABASE_URL) {
  console.error('Migration failed: DATABASE_URL is required. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

try {
  await pool.query(sql);
  console.log('Schema ready.');
} catch (e) {
  console.error('Migration failed:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
