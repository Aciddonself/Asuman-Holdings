import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { pool } from './db.js';

const samples = [
  ['land', 'Titled Plot — Entebbe Road', 'Flat, serviced plot with a clean land title, close to the main road.', 'Entebbe Road, Wakiso', 85000000, 'total', '50 x 100 ft', null, null, [], true],
  ['land', 'Quarter-Acre Plot — Gayaza', 'Dry, well-drained plot in a quiet, fast-growing neighbourhood.', 'Gayaza, Wakiso', 45000000, 'total', '0.25 acre', null, null, [], false],
  ['room', 'Self-contained Single Room', 'Tiled room with private bathroom, water and secure compound.', 'Ntinda, Kampala', 350000, 'month', '1 room', 1, 1, ['Water', 'Security', 'Tiled'], false],
  ['rental', '2-Bedroom Apartment', 'Spacious apartment with parking, balcony and 24/7 security.', 'Kololo, Kampala', 1800000, 'month', '2 bed', 2, 2, ['Parking', 'Balcony', 'Security'], true],
  ['airbnb', 'Lakeview Studio', 'Bright furnished studio with Wi-Fi, kitchenette and lake views.', 'Munyonyo, Kampala', 180000, 'night', 'Studio', 1, 1, ['Wi-Fi', 'Kitchen', 'Lake view'], true],
];

try {
  const email = process.env.ADMIN_EMAIL?.trim();
  const pass = process.env.ADMIN_PASSWORD;
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Set it in server/.env.');
  if (!email || !pass) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required. Set them in server/.env.');
  if (pass.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  const hash = await bcrypt.hash(pass, 12);
  await pool.query(
    `INSERT INTO admins (email, password_hash) VALUES ($1,$2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [email.toLowerCase(), hash]
  );
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM listings');
  if (rows[0].n === 0) {
    for (const s of samples) {
      await pool.query(
        `INSERT INTO listings (category,title,description,location,price,price_unit,size,bedrooms,bathrooms,amenities,featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        s
      );
    }
  }
  console.log(`Seeded. Admin login: ${email}`);
} catch (e) {
  console.error('Seed failed:', e.stack || e.message || e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
