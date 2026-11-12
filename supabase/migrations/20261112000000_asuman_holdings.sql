CREATE TABLE IF NOT EXISTS public.admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listings (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('land','room','rental','airbnb')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  original_price NUMERIC(14,2),
  price_unit TEXT NOT NULL DEFAULT 'total' CHECK (price_unit IN ('total','month','night')),
  currency TEXT NOT NULL DEFAULT 'UGX',
  size TEXT NOT NULL DEFAULT '',
  bedrooms INT,
  bathrooms INT,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','taken')),
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.price_history (
  id SERIAL PRIMARY KEY,
  listing_id INT NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  old_price NUMERIC(14,2) NOT NULL,
  new_price NUMERIC(14,2) NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('update','drop','restore')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.listings(status);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.search_listings(
  p_category TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_min NUMERIC DEFAULT NULL,
  p_max NUMERIC DEFAULT NULL,
  p_drops BOOLEAN DEFAULT false,
  p_featured BOOLEAN DEFAULT false
)
RETURNS SETOF public.listings
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.listings
  WHERE status = 'available'
    AND (p_category IS NULL OR category = p_category)
    AND (p_search IS NULL OR title ILIKE '%' || p_search || '%' OR location ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%')
    AND (p_min IS NULL OR price >= p_min)
    AND (p_max IS NULL OR price <= p_max)
    AND (NOT p_drops OR original_price IS NOT NULL)
    AND (NOT p_featured OR featured = true)
  ORDER BY featured DESC, updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_listing(p_id INTEGER, p_data JSONB)
RETURNS public.listings
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_row public.listings%ROWTYPE;
  updated_row public.listings%ROWTYPE;
  price_changed BOOLEAN := false;
BEGIN
  SELECT * INTO current_row FROM public.listings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found.' USING ERRCODE = 'P0002'; END IF;

  price_changed := p_data ? 'price' AND (p_data->>'price')::NUMERIC IS DISTINCT FROM current_row.price;
  IF price_changed THEN
    INSERT INTO public.price_history (listing_id, old_price, new_price, kind)
    VALUES (p_id, current_row.price, (p_data->>'price')::NUMERIC, 'update');
  END IF;

  UPDATE public.listings SET
    title = CASE WHEN p_data ? 'title' THEN p_data->>'title' ELSE current_row.title END,
    description = CASE WHEN p_data ? 'description' THEN p_data->>'description' ELSE current_row.description END,
    location = CASE WHEN p_data ? 'location' THEN p_data->>'location' ELSE current_row.location END,
    category = CASE WHEN p_data ? 'category' THEN p_data->>'category' ELSE current_row.category END,
    price = CASE WHEN p_data ? 'price' THEN (p_data->>'price')::NUMERIC ELSE current_row.price END,
    original_price = CASE WHEN price_changed THEN NULL ELSE current_row.original_price END,
    price_unit = CASE WHEN p_data ? 'price_unit' THEN p_data->>'price_unit' ELSE current_row.price_unit END,
    currency = CASE WHEN p_data ? 'currency' THEN p_data->>'currency' ELSE current_row.currency END,
    size = CASE WHEN p_data ? 'size' THEN p_data->>'size' ELSE current_row.size END,
    bedrooms = CASE WHEN p_data ? 'bedrooms' THEN NULLIF(p_data->>'bedrooms', '')::INT ELSE current_row.bedrooms END,
    bathrooms = CASE WHEN p_data ? 'bathrooms' THEN NULLIF(p_data->>'bathrooms', '')::INT ELSE current_row.bathrooms END,
    amenities = CASE WHEN p_data ? 'amenities' THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'amenities')) ELSE current_row.amenities END,
    images = CASE WHEN p_data ? 'images' THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'images')) ELSE current_row.images END,
    status = CASE WHEN p_data ? 'status' THEN p_data->>'status' ELSE current_row.status END,
    featured = CASE WHEN p_data ? 'featured' THEN (p_data->>'featured')::BOOLEAN ELSE current_row.featured END,
    updated_at = now()
  WHERE id = p_id RETURNING * INTO updated_row;
  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_drop_listing_price(p_id INTEGER, p_from NUMERIC, p_to NUMERIC)
RETURNS public.listings
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_row public.listings%ROWTYPE;
  updated_row public.listings%ROWTYPE;
BEGIN
  SELECT * INTO current_row FROM public.listings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found.' USING ERRCODE = 'P0002'; END IF;
  IF p_from IS DISTINCT FROM COALESCE(current_row.original_price, current_row.price) OR p_to >= current_row.price THEN
    RAISE EXCEPTION 'The starting price is out of date. Refresh the listing and enter a new price below its current price.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.listings SET price = p_to, original_price = p_from, updated_at = now()
  WHERE id = p_id RETURNING * INTO updated_row;
  INSERT INTO public.price_history (listing_id, old_price, new_price, kind)
  VALUES (p_id, p_from, p_to, 'drop');
  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_listing_price(p_id INTEGER)
RETURNS public.listings
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_row public.listings%ROWTYPE;
  updated_row public.listings%ROWTYPE;
BEGIN
  SELECT * INTO current_row FROM public.listings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found.' USING ERRCODE = 'P0002'; END IF;
  IF current_row.original_price IS NULL THEN RAISE EXCEPTION 'This listing has no active price drop.' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.listings SET price = original_price, original_price = NULL, updated_at = now()
  WHERE id = p_id RETURNING * INTO updated_row;
  INSERT INTO public.price_history (listing_id, old_price, new_price, kind)
  VALUES (p_id, current_row.price, updated_row.price, 'restore');
  RETURN updated_row;
END;
$$;
