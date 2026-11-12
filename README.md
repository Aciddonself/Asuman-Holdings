# Asuman Holdings — Your Dreamland Stream

Property, land, Airbnb and rentals in Uganda. React (Vite) + Supabase Edge Functions + Supabase PostgreSQL and Storage.

Use Node.js 22.12 or newer and npm 10 or newer for both applications.

Public site: Asuman Holdings' navy, gold, and warm-neutral brand, property-story and services sections, featured listings, photo and video tours, testimonials, and WhatsApp inquiry form. Listings remain connected to the API, with category, keyword, and price filters, price drops, and call/WhatsApp actions. The logo and property photography are in `client/public/images`; the property-tour videos use the Pexels sources shown in the gallery. Contact details are set in `client/src/config.js`.

## Setup

1. For local development, create a PostgreSQL database: `createdb asuman_holdings` (or create it with your database tool).
2. Local API
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
3. Frontend (local API)
   ```
   cd client
   npm ci
   npm run dev              # http://localhost:5173 (proxies /api and /uploads to :5000)
   ```
4. Sign in at `/admin/login` with the email/password from `server/.env`.

The API requires `DATABASE_URL` and a `JWT_SECRET` of at least 32 characters. The seed command also requires `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12 or more characters, no more than 72 UTF-8 bytes); there is no default admin password. Generate a unique JWT secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## What the admin can do

- Add, edit, delete lands, rooms, rentals and Airbnb listings (price, per month / per night / one-off, size, beds, baths, amenities, description).
- Upload photos (JPG/PNG/WEBP/GIF, up to 8 MB each) — stored in Supabase Storage in production and `server/uploads` locally.
- Mark a listing taken/available (taken listings are hidden from the public site).
- **Drop a price from X to Y**: "Price" button → enter the old and new amounts. The public site shows the new price, the old price crossed out and a `-%` badge. "Restore" brings the original price back. Editing the price manually ends a drop. Every change is logged in `price_history`.

## Notes

- Theme colours and fonts are CSS variables at the top of `client/src/styles.css`.
- Netlify: `netlify.toml` configures the Vite build and SPA fallback. Set `VITE_API_BASE_URL` to `https://<project-ref>.supabase.co/functions/v1` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the project's publishable key.
- Supabase: the Edge API is `supabase/functions/api`; `supabase/config.toml` disables gateway JWT validation for this function because it validates the app's admin JWT itself. Set Edge Function secrets `ADMIN_JWT_SECRET` (unique random string of at least 32 characters) and `CLIENT_ORIGIN` (the exact Netlify origin, plus localhost only for local browser development). Supabase injects the server-only key used by the function; never put a secret/service-role key in Netlify or client code.
- Supabase setup: link the Supabase CLI to the selected project, then run `npx supabase db push --remote`, `npx supabase seed buckets --remote`, and `npx supabase functions deploy api --project-ref <project-ref> --no-verify-jwt`. Create the admin account with `npm run seed` from `server` using that project's PostgreSQL connection string in `server/.env`; sample listings are added only when there are no listings. Keep database passwords out of Git.
- The `property-images` bucket is public so published listing photos can load on the public site; uploads and deletes still go through the authenticated Edge Function. The free Supabase plan includes 500 MB database and 1 GB storage, and can pause projects after a week of inactivity.
- Change the admin password by editing `server/.env` and re-running `npm run seed` against the same database.
