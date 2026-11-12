import { createClient } from 'npm:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
const serviceKey = secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const bucket = 'property-images';
const allowedOrigins = (Deno.env.get('CLIENT_ORIGIN') ?? '')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const jwtSecret = Deno.env.get('ADMIN_JWT_SECRET') ?? '';
const encoder = new TextEncoder();
const supabase = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const categories = ['land', 'room', 'rental', 'airbnb'];
const units = ['total', 'month', 'night'];
const statuses = ['available', 'taken'];
const imageTypes: Record<string, { extension: string; matches: (bytes: Uint8Array) => boolean }> = {
  'image/jpeg': { extension: '.jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { extension: '.png', matches: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((n, i) => b[i] === n) },
  'image/webp': { extension: '.webp', matches: (b) => new TextDecoder().decode(b.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(b.slice(8, 12)) === 'WEBP' },
  'image/gif': { extension: '.gif', matches: (b) => ['GIF87a', 'GIF89a'].includes(new TextDecoder().decode(b.slice(0, 6))) },
};

function corsHeaders(req: Request) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  });
  const origin = req.headers.get('origin');
  if (origin && allowedOrigins.includes(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

function json(req: Request, value: unknown, status = 200) {
  const headers = corsHeaders(req);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(value), { status, headers });
}

function routePath(pathname: string) {
  const functionPrefix = '/functions/v1/api';
  const prefixIndex = pathname.indexOf(functionPrefix);
  if (prefixIndex >= 0) {
    let suffix = pathname.slice(prefixIndex + functionPrefix.length) || '/';
    // The client appends /api/... to the Supabase functions/v1 base URL,
    // producing /functions/v1/api/api/.... Strip that second API segment.
    if (suffix === '/api') suffix = '/';
    else if (suffix.startsWith('/api/')) suffix = suffix.slice(4);
    return suffix;
  }
  const segments = pathname.split('/').filter(Boolean);
  const apiIndex = segments.indexOf('api');
  return apiIndex >= 0 ? `/${segments.slice(apiIndex + 1).join('/')}` || '/' : pathname;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getHmacKey() {
  if (!jwtSecret || jwtSecret.length < 32) throw new Error('Admin token signing is not configured.');
  return crypto.subtle.importKey('raw', encoder.encode(jwtSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function signToken(admin: { id: number; email: string }) {
  const header = encodeBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = encodeBase64Url(encoder.encode(JSON.stringify({ id: admin.id, email: admin.email, iat: now, exp: now + 8 * 60 * 60 })));
  const unsigned = `${header}.${payload}`;
  const signature = await crypto.subtle.sign('HMAC', await getHmacKey(), encoder.encode(unsigned));
  return `${unsigned}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function getAdmin(req: Request) {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    if (header.alg !== 'HS256') return null;
    const unsigned = `${parts[0]}.${parts[1]}`;
    const valid = await crypto.subtle.verify('HMAC', await getHmacKey(), decodeBase64Url(parts[2]), encoder.encode(unsigned));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    if (!payload.id || !payload.email || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload as { id: number; email: string };
  } catch {
    return null;
  }
}

async function readJson(req: Request) {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function clean(body: Record<string, unknown>, partial = false) {
  const out: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const key of ['title', 'description', 'location', 'size', 'currency']) {
    if (body[key] !== undefined) out[key] = String(body[key]).trim();
  }
  if (body.category !== undefined) {
    if (!categories.includes(String(body.category))) errors.push('Invalid category.');
    else out.category = body.category;
  }
  if (body.price_unit !== undefined) {
    if (!units.includes(String(body.price_unit))) errors.push('Invalid price unit.');
    else out.price_unit = body.price_unit;
  }
  if (body.status !== undefined) {
    if (!statuses.includes(String(body.status))) errors.push('Invalid status.');
    else out.status = body.status;
  }
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) errors.push('Price must be a non-negative number.');
    else out.price = price;
  }
  for (const key of ['bedrooms', 'bathrooms']) {
    if (body[key] !== undefined) out[key] = body[key] === '' || body[key] === null ? null : Math.max(0, Number.parseInt(String(body[key]), 10) || 0);
  }
  if (body.featured !== undefined) out.featured = body.featured === true || body.featured === 'true';
  if (body.amenities !== undefined) {
    out.amenities = (Array.isArray(body.amenities) ? body.amenities : String(body.amenities).split(','))
      .map((item) => String(item).trim()).filter(Boolean);
  }
  if (body.images !== undefined) out.images = (Array.isArray(body.images) ? body.images : []).map(String);
  if (!partial) {
    if (!out.title) errors.push('Title is required.');
    if (!out.category) errors.push('Category is required.');
    if (out.price === undefined) errors.push('Price is required.');
  }
  return { out, errors };
}

function dbError(req: Request, error: { code?: string; message?: string }) {
  const status = error.code === 'P0002' ? 404 : error.code === 'P0001' ? 400 : 500;
  if (status === 500) console.error('Supabase API error:', error.code ?? 'unknown', error.message ?? 'unknown');
  return json(req, { error: status === 500 ? 'Something went wrong on the server.' : error.message }, status);
}

function isValidImage(type: string, bytes: Uint8Array) {
  return Boolean(imageTypes[type]?.matches(bytes));
}

function storagePathFromUrl(value: string) {
  const prefix = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;
  if (!value.startsWith(prefix)) return null;
  try { return decodeURIComponent(value.slice(prefix.length)); } catch { return null; }
}

async function removeStorageObjects(urls: string[]) {
  const paths = urls.map(storagePathFromUrl).filter((path): path is string => Boolean(path));
  if (!paths.length || !supabase) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) console.error('Supabase Storage cleanup failed:', error.message);
}

async function handle(req: Request) {
  const route = routePath(new URL(req.url).pathname);
  const method = req.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (!supabase) return json(req, { error: 'Supabase API is not configured.' }, 503);

  if (method === 'GET' && route === '/health') {
    const { error } = await supabase.from('listings').select('id').limit(1);
    return error ? dbError(req, error) : json(req, { ok: true });
  }

  if (method === 'POST' && route === '/auth/login') {
    let body: Record<string, unknown>;
    try { body = await readJson(req); } catch (error) { return json(req, { error: (error as Error).message }, 400); }
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (email.length > 254 || encoder.encode(password).byteLength > 72) return json(req, { error: 'Email or password is too long.' }, 400);
    const { data: admin, error } = await supabase.from('admins').select('id,email,password_hash').eq('email', email).maybeSingle();
    if (error) return json(req, { error: 'Admin login is temporarily unavailable. Check that the database migration and seed have completed.' }, 503);
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) return json(req, { error: 'Invalid email or password.' }, 401);
    return json(req, { token: await signToken({ id: admin.id, email: admin.email }), email: admin.email });
  }

  if (method === 'GET' && route === '/auth/me') {
    const admin = await getAdmin(req);
    return admin ? json(req, { email: admin.email }) : json(req, { error: 'Please sign in as admin.' }, 401);
  }

  if (method === 'GET' && route === '/listings') {
    const url = new URL(req.url);
    const searchValues = url.searchParams.getAll('q');
    const search = searchValues[0]?.trim() || null;
    if (searchValues.length > 1) return json(req, { error: 'Search text must be a single string.' }, 400);
    if (search && search.length > 200) return json(req, { error: 'Search text must be 200 characters or fewer.' }, 400);
    const prices: Record<string, number> = {};
    for (const key of ['min', 'max']) {
      const values = url.searchParams.getAll(key);
      if (values.length > 1) return json(req, { error: `${key} price must be a single number.` }, 400);
      const raw = values[0];
      if (raw === undefined || raw.trim() === '') continue;
      const value = Number(raw.trim());
      if (!Number.isFinite(value) || value < 0) return json(req, { error: `${key} price must be a non-negative number.` }, 400);
      prices[key] = value;
    }
    if (prices.min !== undefined && prices.max !== undefined && prices.min > prices.max) {
      return json(req, { error: 'Minimum price cannot exceed maximum price.' }, 400);
    }
    const { data, error } = await supabase.rpc('search_listings', {
      p_category: categories.includes(url.searchParams.get('category') ?? '') ? url.searchParams.get('category') : null,
      p_search: search,
      p_min: prices.min ?? null,
      p_max: prices.max ?? null,
      p_drops: url.searchParams.get('drops') === 'true',
      p_featured: url.searchParams.get('featured') === 'true',
    });
    return error ? dbError(req, error) : json(req, data);
  }

  const publicListing = /^\/listings\/(\d+)$/.exec(route);
  if (method === 'GET' && publicListing) {
    const { data, error } = await supabase.from('listings').select('*').eq('id', Number(publicListing[1])).eq('status', 'available').maybeSingle();
    if (error) return dbError(req, error);
    return data ? json(req, data) : json(req, { error: 'Listing not found.' }, 404);
  }

  const isAdminRoute = route === '/admin/listings' || route.startsWith('/admin/listings/');
  const admin = isAdminRoute ? await getAdmin(req) : null;
  if (isAdminRoute && !admin) return json(req, { error: 'Please sign in as admin.' }, 401);

  if (method === 'GET' && route === '/admin/listings') {
    const { data, error } = await supabase.from('listings').select('*').order('updated_at', { ascending: false });
    return error ? dbError(req, error) : json(req, data);
  }

  if (method === 'GET' && route === '/admin/listings/stats') {
    const { data, error } = await supabase.from('listings').select('category,status,original_price');
    if (error) return dbError(req, error);
    const result = categories.map((category) => {
      const rows = data.filter((item) => item.category === category);
      return {
        category,
        total: rows.length,
        available: rows.filter((item) => item.status === 'available').length,
        dropped: rows.filter((item) => item.original_price !== null).length,
      };
    });
    return json(req, result);
  }

  if (method === 'POST' && route === '/admin/listings') {
    let body: Record<string, unknown>;
    try { body = await readJson(req); } catch (error) { return json(req, { error: (error as Error).message }, 400); }
    const { out, errors } = clean(body);
    if (errors.length) return json(req, { error: errors.join(' ') }, 400);
    const { data, error } = await supabase.from('listings').insert(out).select().single();
    return error ? dbError(req, error) : json(req, data, 201);
  }

  const uploadRoute = route === '/admin/listings/upload';
  if (method === 'POST' && uploadRoute) {
    const length = Number(req.headers.get('content-length') ?? 0);
    if (length > 9 * 1024 * 1024) return json(req, { error: 'Upload request is too large.' }, 413);
    let form: FormData;
    try { form = await req.formData(); } catch { return json(req, { error: 'Upload must use multipart form data.' }, 400); }
    const files = form.getAll('images');
    if (!files.length || files.length > 10 || files.some((file) => !(file instanceof File))) {
      return json(req, { error: 'Choose between 1 and 10 image files.' }, 400);
    }
    const uploadedUrls: string[] = [];
    for (const file of files as File[]) {
      const type = imageTypes[file.type];
      if (!type) { await removeStorageObjects(uploadedUrls); return json(req, { error: 'Only JPG, PNG, WEBP or GIF images are allowed.' }, 400); }
      if (file.size > 8 * 1024 * 1024) { await removeStorageObjects(uploadedUrls); return json(req, { error: 'Each image must be 8 MB or smaller.' }, 400); }
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (!type.matches(bytes)) { await removeStorageObjects(uploadedUrls); return json(req, { error: 'An uploaded file is not a valid JPG, PNG, WEBP or GIF image.' }, 400); }
      const filename = `${crypto.randomUUID().replaceAll('-', '')}${type.extension}`;
      const { error } = await supabase.storage.from(bucket).upload(filename, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) {
        await removeStorageObjects(uploadedUrls);
        console.error('Supabase image upload failed:', error.message);
        return json(req, { error: 'Supabase Storage could not save the image. Check that the property-images bucket exists.' }, 502);
      }
      uploadedUrls.push(supabase.storage.from(bucket).getPublicUrl(filename).data.publicUrl);
    }
    return json(req, { urls: uploadedUrls });
  }

  const listingPriceDrop = /^\/admin\/listings\/(\d+)\/drop-price$/.exec(route);
  if (method === 'POST' && listingPriceDrop) {
    let body: Record<string, unknown>;
    try { body = await readJson(req); } catch (error) { return json(req, { error: (error as Error).message }, 400); }
    const from = body.from === '' || body.from == null ? Number.NaN : Number(body.from);
    const to = body.to === '' || body.to == null ? Number.NaN : Number(body.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < 0) return json(req, { error: 'Enter valid amounts for both prices.' }, 400);
    if (to >= from) return json(req, { error: 'The new price must be lower than the old price.' }, 400);
    const { data, error } = await supabase.rpc('admin_drop_listing_price', { p_id: Number(listingPriceDrop[1]), p_from: from, p_to: to });
    return error ? dbError(req, error) : json(req, data);
  }

  const listingRestore = /^\/admin\/listings\/(\d+)\/restore-price$/.exec(route);
  if (method === 'POST' && listingRestore) {
    const { data, error } = await supabase.rpc('admin_restore_listing_price', { p_id: Number(listingRestore[1]) });
    return error ? dbError(req, error) : json(req, data);
  }

  const listingHistory = /^\/admin\/listings\/(\d+)\/history$/.exec(route);
  if (method === 'GET' && listingHistory) {
    const { data, error } = await supabase.from('price_history').select('*').eq('listing_id', Number(listingHistory[1])).order('changed_at', { ascending: false });
    return error ? dbError(req, error) : json(req, data);
  }

  const listingId = /^\/admin\/listings\/(\d+)$/.exec(route);
  if (method === 'PUT' && listingId) {
    let body: Record<string, unknown>;
    try { body = await readJson(req); } catch (error) { return json(req, { error: (error as Error).message }, 400); }
    const { out, errors } = clean(body, true);
    if (errors.length) return json(req, { error: errors.join(' ') }, 400);
    const { data, error } = await supabase.rpc('admin_update_listing', { p_id: Number(listingId[1]), p_data: out });
    return error ? dbError(req, error) : json(req, data);
  }

  if (method === 'DELETE' && listingId) {
    const { data, error } = await supabase.from('listings').delete().eq('id', Number(listingId[1])).select('images').maybeSingle();
    if (error) return dbError(req, error);
    if (!data) return json(req, { error: 'Listing not found.' }, 404);
    await removeStorageObjects(data.images ?? []);
    return json(req, { ok: true });
  }

  return json(req, { error: 'Not found.' }, 404);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (origin && !allowedOrigins.includes(origin)) return json(req, { error: 'Origin is not allowed.' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  try {
    return await handle(req);
  } catch (error) {
    console.error('Supabase API request failed:', error instanceof Error ? error.message : 'unknown error');
    return json(req, { error: 'Something went wrong on the server.' }, 500);
  }
});
