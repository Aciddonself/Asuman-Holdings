import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool, query } from './db.js';
import { requireAdmin } from './auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const uploadDir = path.join(here, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) =>
      cb(null, crypto.randomBytes(12).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) =>
    cb(/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) ? null : new Error('Only JPG, PNG, WEBP or GIF images are allowed.'), true),
});

const CATEGORIES = ['land', 'room', 'rental', 'airbnb'];
const UNITS = ['total', 'month', 'night'];
const STATUSES = ['available', 'taken'];

function clean(body, partial = false) {
  const out = {};
  const errors = [];
  const str = (k) => { if (body[k] !== undefined) out[k] = String(body[k]).trim(); };
  ['title', 'description', 'location', 'size', 'currency'].forEach(str);
  if (body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) errors.push('Invalid category.'); else out.category = body.category;
  }
  if (body.price_unit !== undefined) {
    if (!UNITS.includes(body.price_unit)) errors.push('Invalid price unit.'); else out.price_unit = body.price_unit;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) errors.push('Invalid status.'); else out.status = body.status;
  }
  if (body.price !== undefined) {
    const p = Number(body.price);
    if (!Number.isFinite(p) || p < 0) errors.push('Price must be a positive number.'); else out.price = p;
  }
  ['bedrooms', 'bathrooms'].forEach((k) => {
    if (body[k] !== undefined) out[k] = body[k] === '' || body[k] === null ? null : Math.max(0, parseInt(body[k], 10) || 0);
  });
  if (body.featured !== undefined) out.featured = body.featured === true || body.featured === 'true';
  if (body.amenities !== undefined) {
    out.amenities = (Array.isArray(body.amenities) ? body.amenities : String(body.amenities).split(','))
      .map((a) => String(a).trim()).filter(Boolean);
  }
  if (body.images !== undefined) out.images = (Array.isArray(body.images) ? body.images : []).map(String);
  if (!partial) {
    if (!out.title) errors.push('Title is required.');
    if (!out.category) errors.push('Category is required.');
    if (out.price === undefined) errors.push('Price is required.');
  }
  return { out, errors };
}

export const publicRouter = Router();
export const adminRouter = Router();

// ---------- PUBLIC ----------
publicRouter.get('/', async (req, res) => {
  const { category, q, min, max, drops, featured, includeTaken } = req.query;
  const where = [];
  const params = [];
  if (!includeTaken) where.push(`status = 'available'`);
  if (CATEGORIES.includes(category)) { params.push(category); where.push(`category = $${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`(title ILIKE $${params.length} OR location ILIKE $${params.length} OR description ILIKE $${params.length})`); }
  if (min) { params.push(Number(min)); where.push(`price >= $${params.length}`); }
  if (max) { params.push(Number(max)); where.push(`price <= $${params.length}`); }
  if (drops === 'true') where.push('original_price IS NOT NULL');
  if (featured === 'true') where.push('featured = true');
  const sql = `SELECT * FROM listings ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY featured DESC, updated_at DESC`;
  const { rows } = await query(sql, params);
  res.json(rows);
});

publicRouter.get('/:id(\\d+)', async (req, res) => {
  const { rows } = await query('SELECT * FROM listings WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Listing not found.' });
  res.json(rows[0]);
});

// ---------- ADMIN ----------
adminRouter.use(requireAdmin);

adminRouter.get('/', async (_req, res) => {
  const { rows } = await query('SELECT * FROM listings ORDER BY updated_at DESC');
  res.json(rows);
});

adminRouter.get('/stats', async (_req, res) => {
  const { rows } = await query(`
    SELECT category,
           count(*)::int AS total,
           count(*) FILTER (WHERE status = 'available')::int AS available,
           count(*) FILTER (WHERE original_price IS NOT NULL)::int AS dropped
    FROM listings GROUP BY category`);
  res.json(rows);
});

adminRouter.post('/', async (req, res) => {
  const { out, errors } = clean(req.body || {});
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const cols = Object.keys(out);
  const { rows } = await query(
    `INSERT INTO listings (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`,
    cols.map((c) => out[c])
  );
  res.status(201).json(rows[0]);
});

adminRouter.put('/:id(\\d+)', async (req, res) => {
  const { out, errors } = clean(req.body || {}, true);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = (await client.query('SELECT * FROM listings WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!cur) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Listing not found.' }); }

    // A manual price edit ends any active price drop and is logged.
    if (out.price !== undefined && Number(out.price) !== Number(cur.price)) {
      out.original_price = null;
      await client.query(
        `INSERT INTO price_history (listing_id, old_price, new_price, kind) VALUES ($1,$2,$3,'update')`,
        [cur.id, cur.price, out.price]
      );
    }
    const cols = Object.keys(out);
    if (!cols.length) { await client.query('ROLLBACK'); return res.json(cur); }
    const { rows } = await client.query(
      `UPDATE listings SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = now()
       WHERE id = $${cols.length + 1} RETURNING *`,
      [...cols.map((c) => out[c]), req.params.id]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// Drop a price from X to Y (e.g. 1,000,000 -> 800,000). X is shown crossed out publicly.
adminRouter.post('/:id(\\d+)/drop-price', async (req, res) => {
  const from = Number(req.body?.from);
  const to = Number(req.body?.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < 0)
    return res.status(400).json({ error: 'Enter valid amounts for both prices.' });
  if (to >= from) return res.status(400).json({ error: 'The new price must be lower than the old price.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = (await client.query('SELECT * FROM listings WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!cur) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Listing not found.' }); }
    const { rows } = await client.query(
      `UPDATE listings SET price = $1, original_price = $2, updated_at = now() WHERE id = $3 RETURNING *`,
      [to, from, cur.id]
    );
    await client.query(
      `INSERT INTO price_history (listing_id, old_price, new_price, kind) VALUES ($1,$2,$3,'drop')`,
      [cur.id, from, to]
    );
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// End a price drop and go back to the original price.
adminRouter.post('/:id(\\d+)/restore-price', async (req, res) => {
  const cur = (await query('SELECT * FROM listings WHERE id = $1', [req.params.id])).rows[0];
  if (!cur) return res.status(404).json({ error: 'Listing not found.' });
  if (cur.original_price === null) return res.status(400).json({ error: 'This listing has no active price drop.' });
  const { rows } = await query(
    `UPDATE listings SET price = original_price, original_price = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
    [cur.id]
  );
  await query(
    `INSERT INTO price_history (listing_id, old_price, new_price, kind) VALUES ($1,$2,$3,'restore')`,
    [cur.id, cur.price, rows[0].price]
  );
  res.json(rows[0]);
});

adminRouter.get('/:id(\\d+)/history', async (req, res) => {
  const { rows } = await query('SELECT * FROM price_history WHERE listing_id = $1 ORDER BY changed_at DESC', [req.params.id]);
  res.json(rows);
});

adminRouter.delete('/:id(\\d+)', async (req, res) => {
  const { rows } = await query('DELETE FROM listings WHERE id = $1 RETURNING images', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Listing not found.' });
  for (const url of rows[0].images) {
    const file = path.join(uploadDir, path.basename(url));
    fs.promises.unlink(file).catch(() => {});
  }
  res.json({ ok: true });
});

// Upload images -> returns URLs the admin form stores on the listing.
adminRouter.post('/upload', (req, res) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ urls: (req.files || []).map((f) => `/uploads/${f.filename}`) });
  });
});
