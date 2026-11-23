ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_status_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_status_check
  CHECK (status IN ('available', 'coming_soon', 'taken'));

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
  WHERE status IN ('available', 'coming_soon', 'taken')
    AND (p_category IS NULL OR category = p_category)
    AND (p_search IS NULL OR title ILIKE '%' || p_search || '%' OR location ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%')
    AND (p_min IS NULL OR price >= p_min)
    AND (p_max IS NULL OR price <= p_max)
    AND (NOT p_drops OR original_price IS NOT NULL)
    AND (NOT p_featured OR featured = true)
  ORDER BY featured DESC, updated_at DESC;
$$;
