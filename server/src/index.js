import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './auth.js';
import { publicRouter, adminRouter, uploadDir } from './listings.js';

// Express 4 doesn't catch async errors by itself; wrap routers' handlers.
import { Router } from 'express';
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

const missingConfig = ['DATABASE_URL', 'JWT_SECRET'].filter((name) => !process.env[name]);
if (missingConfig.length) {
  console.error(`Missing required configuration: ${missingConfig.join(', ')}. Copy .env.example to .env and fill it in.`);
  process.exit(1);
}

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : true }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/listings', publicRouter);
app.use('/api/admin/listings', adminRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
