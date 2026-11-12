# Asuman Holdings — Your Dreamland Stream

Property, land, Airbnb and rentals in Uganda. React (Vite) + Express + PostgreSQL.

Use Node.js 22.12 or newer and npm 10 or newer for both applications.

Public site: Asuman Holdings' navy, gold, and warm-neutral brand, property-story and services sections, featured listings, photo and video tours, testimonials, and WhatsApp inquiry form. Listings remain connected to the API, with category, keyword, and price filters, price drops, and call/WhatsApp actions. The logo and property photography are in `client/public/images`; the property-tour videos use the Pexels sources shown in the gallery. Contact details are set in `client/src/config.js`.

## Setup

1. Create the database: `createdb asuman_holdings` (or create a PostgreSQL database named `asuman_holdings` with your database tool).
2. Backend
   ```
   cd server
   # Copy .env.example to .env, then set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, and ADMIN_PASSWORD.
   # PowerShell: Copy-Item .env.example .env
   # macOS/Linux: cp .env.example .env
   npm ci
   npm run migrate          # creates tables
   npm run seed             # creates the admin + 5 sample listings (delete the samples from the dashboard)
   npm run dev              # http://localhost:5000
   ```
3. Frontend
   ```
   cd client
   npm ci
   npm run dev              # http://localhost:5173 (proxies /api and /uploads to :5000)
   ```
4. Sign in at `/admin/login` with the email/password from `server/.env`.

The API requires `DATABASE_URL` and a `JWT_SECRET` of at least 32 characters. The seed command also requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12 or more characters, no more than 72 UTF-8 bytes); there is no default admin password. Generate a unique JWT secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## What the admin can do

- Add, edit, delete lands, rooms, rentals and Airbnb listings (price, per month / per night / one-off, size, beds, baths, amenities, description).
- Upload photos (JPG/PNG/WEBP/GIF, up to 8 MB each) — stored in `server/uploads`.
- Mark a listing taken/available (taken listings are hidden from the public site).
- **Drop a price from X to Y**: "Price" button → enter the old and new amounts. The public site shows the new price, the old price crossed out and a `-%` badge. "Restore" brings the original price back. Editing the price manually ends a drop. Every change is logged in `price_history`.

## Notes

- Theme colours and fonts are CSS variables at the top of `client/src/styles.css`.
- Production: `npm run build` in `client`, serve `client/dist` with SPA fallback for routes such as `/listing/:id` and `/admin`, and reverse-proxy `/api` and `/uploads` to the Express server. Set `NODE_ENV=production`, `CLIENT_ORIGIN` to the comma-separated allowed site origins, and use a strong unique `JWT_SECRET` and `ADMIN_PASSWORD`. The API refuses to start in production without `CLIENT_ORIGIN`.
- Keep `server/uploads` on persistent storage in production. Deployments with ephemeral filesystems will lose listing photos on restart; use a persistent volume or object storage there.
- Change the admin password by editing `server/.env` and re-running `npm run seed`.
