import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { query } from './db.js';

export function requireAdmin(req, res, next) {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')?.[1];
  if (!token) return res.status(401).json({ error: 'Please sign in as admin.' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in as admin.' });
  }
}

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const normalizedEmail = String(email).trim().toLowerCase();
  const passwordValue = String(password);
  if (normalizedEmail.length > 254 || Buffer.byteLength(passwordValue, 'utf8') > 72) {
    return res.status(400).json({ error: 'Email or password is too long.' });
  }
  let rows;
  try {
    ({ rows } = await query('SELECT * FROM admins WHERE email = $1', [normalizedEmail]));
  } catch (error) {
    const unavailable = {
      ECONNREFUSED: 'PostgreSQL cannot be reached. Start PostgreSQL and try again.',
      '28P01': 'The database credentials in server/.env do not match PostgreSQL. Update DATABASE_URL and restart the server.',
      '3D000': 'The application database does not exist. Create asuman_holdings, then run npm run migrate and npm run seed from the server directory.',
    }[error.code];
    if (unavailable) {
      console.error(`Admin login unavailable: PostgreSQL error ${error.code}.`);
      return res.status(503).json({
        error: `Admin login is temporarily unavailable. ${unavailable}`,
      });
    }
    throw error;
  }
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(passwordValue, admin.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' });
  res.json({ token, email: admin.email });
});

authRouter.get('/me', requireAdmin, (req, res) => res.json({ email: req.admin.email }));
