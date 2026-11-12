import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { query } from './db.js';

export function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in as admin.' });
  }
}

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  let rows;
  try {
    ({ rows } = await query('SELECT * FROM admins WHERE email = $1', [String(email).toLowerCase()]));
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
  if (!admin || !(await bcrypt.compare(String(password), admin.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, email: admin.email });
});

authRouter.get('/me', requireAdmin, (req, res) => res.json({ email: req.admin.email }));
