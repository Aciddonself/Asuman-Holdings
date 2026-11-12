CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('land','room','rental','airbnb')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  original_price NUMERIC(14,2),            -- set while a price drop is active
  price_unit TEXT NOT NULL DEFAULT 'total' CHECK (price_unit IN ('total','month','night')),
  currency TEXT NOT NULL DEFAULT 'UGX',
  size TEXT NOT NULL DEFAULT '',            -- e.g. "50 x 100 ft" or "2 acres"
  bedrooms INT,
  bathrooms INT,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','taken')),
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);

CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  listing_id INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  old_price NUMERIC(14,2) NOT NULL,
  new_price NUMERIC(14,2) NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('update','drop','restore')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
