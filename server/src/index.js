import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './auth.js';
import { publicRouter, adminRouter, uploadDir } from './listings.js';
import { query } from './db.js';

// Express 4 doesn't catch async errors by itself; wrap routers' handlers.
for (const r of [publicRouter, adminRouter, authRouter]) {
  r.stack.forEach((layer) => {
    if (layer.route) {
      layer.route.stack.forEach((l) => {
        const fn = l.handle;
        if (fn.constructor.name === 'AsyncFunction') {
          l.handle = (req, res, next) => fn(req, res, next).catch(next);
        }
      });
    }
  });
}

const configuredOrigins = process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) || [];
const allowedOrigins = configuredOrigins.map((origin) => {
  try {
    const url = new URL(origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
});
if (allowedOrigins.some((origin) => origin === null)) {
  console.error('CLIENT_ORIGIN must contain valid HTTP or HTTPS origins.');
  process.exit(1);
}
const missingConfig = ['DATABASE_URL', 'JWT_SECRET'].filter((name) => !process.env[name]);
if (process.env.DATABASE_URL && /your_database_password|replace_with_/i.test(process.env.DATABASE_URL)) {
  missingConfig.push('DATABASE_URL (replace the example value)');
}
if (process.env.JWT_SECRET && /^replace_with_/i.test(process.env.JWT_SECRET)) {
  missingConfig.push('JWT_SECRET (replace the example value)');
}
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  missingConfig.push('JWT_SECRET (must be at least 32 characters)');
}
if (process.env.NODE_ENV === 'production' && !allowedOrigins.length) {
  missingConfig.push('CLIENT_ORIGIN (required in production)');
}
if (missingConfig.length) {
  console.error(`Missing required configuration: ${missingConfig.join(', ')}. Copy .env.example to .env and fill it in.`);
  process.exit(1);
}

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

app.get('/api/health', async (_req, res, next) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
app.use('/api/auth', authRouter);
app.use('/api/listings', publicRouter);
app.use('/api/admin/listings', adminRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status >= 500) console.error(err);
  const message = status === 413 ? 'Request body is too large.' : status === 400 ? 'Request body is invalid.' : 'Something went wrong on the server.';
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer from 1 to 65535.');
  process.exit(1);
}
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
