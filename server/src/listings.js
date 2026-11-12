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

const imageTypes = {
  'image/jpeg': { extension: '.jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { extension: '.png', matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { extension: '.webp', matches: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  'image/gif': { extension: '.gif', matches: (b) => ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6)) },
};

async function isValidImage(file) {
  if (!Object.hasOwn(imageTypes, file.mimetype)) return false;
  const type = imageTypes[file.mimetype];
  if (!type) return false;
  const handle = await fs.promises.open(file.path, 'r');
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return bytesRead >= 3 && type.matches(buffer);
  } finally {
    await handle.close();
  }
}

async function removeUploaded(files) {
  await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})));
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) =>
      cb(null, crypto.randomBytes(12).toString('hex') + imageTypes[file.mimetype].extension),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (!Object.hasOwn(imageTypes, file.mimetype)) return cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed.'));
    cb(null, true);
  },
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
    if (!Number.isFinite(p) || p < 0) errors.push('Price must be a non-negative number.'); else out.price = p;
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
  const { category, q, min, max, drops, featured } = req.query;
  const where = ["status = 'available'"];
  const params = [];
  if (CATEGORIES.includes(category)) { params.push(category); where.push(`category = $${params.length}`); }
  if (q !== undefined && typeof q !== 'string') return res.status(400).json({ error: 'Search text must be a single string.' });
  const search = q?.trim();
  if (search) {
    if (search.length > 200) return res.status(400).json({ error: 'Search text must be 200 characters or fewer.' });
    params.push(`%${search}%`);
    where.push(`(title ILIKE $${params.length} OR location ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }
  const prices = {};
  for (const [key, operator] of [['min', '>='], ['max', '<=']]) {
    const raw = req.query[key];
    if (raw === undefined || (typeof raw === 'string' && raw.trim() === '')) continue;
    const value = typeof raw === 'string' ? Number(raw.trim()) : Number.NaN;
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({ error: `${key} price must be a non-negative number.` });
    }
    prices[key] = value;
    params.push(value);
    where.push(`price ${operator} $${params.length}`);
  }
  if (prices.min !== undefined && prices.max !== undefined && prices.min > prices.max) {
    return res.status(400).json({ error: 'Minimum price cannot exceed maximum price.' });
  }
  if (drops === 'true') where.push('original_price IS NOT NULL');
  if (featured === 'true') where.push('featured = true');
  const sql = `SELECT * FROM listings ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY featured DESC, updated_at DESC`;
  const { rows } = await query(sql, params);
  res.json(rows);
});

publicRouter.get('/:id(\\d+)', async (req, res) => {
  const { rows } = await query("SELECT * FROM listings WHERE id = $1 AND status = 'available'", [req.params.id]);
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
  const from = req.body?.from === '' || req.body?.from == null ? Number.NaN : Number(req.body.from);
  const to = req.body?.to === '' || req.body?.to == null ? Number.NaN : Number(req.body.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < 0)
    return res.status(400).json({ error: 'Enter valid amounts for both prices.' });
  if (to >= from) return res.status(400).json({ error: 'The new price must be lower than the old price.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = (await client.query('SELECT * FROM listings WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!cur) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Listing not found.' }); }
    const expectedFrom = Number(cur.original_price ?? cur.price);
    if (from !== expectedFrom || to >= Number(cur.price)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'The starting price is out of date. Refresh the listing and enter a new price below its current price.' });
    }
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = (await client.query('SELECT * FROM listings WHERE id = $1 FOR UPDATE', [req.params.id])).rows[0];
    if (!cur) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Listing not found.' }); }
    if (cur.original_price === null) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This listing has no active price drop.' });
    }
    const { rows } = await client.query(
      `UPDATE listings SET price = original_price, original_price = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
      [cur.id]
    );
    await client.query(
      `INSERT INTO price_history (listing_id, old_price, new_price, kind) VALUES ($1,$2,$3,'restore')`,
      [cur.id, cur.price, rows[0].price]
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
  upload.array('images', 10)(req, res, async (err) => {
    const files = req.files || [];
    if (err) {
      await removeUploaded(files);
      return res.status(400).json({ error: err.message });
    }
    try {
      for (const file of files) {
        if (!await isValidImage(file)) throw new Error('An uploaded file is not a valid JPG, PNG, WEBP or GIF image.');
      }
      res.json({ urls: files.map((f) => `/uploads/${f.filename}`) });
    } catch (error) {
      await removeUploaded(files);
      res.status(400).json({ error: error.message });
    }
  });
});
