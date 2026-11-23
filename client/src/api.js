const TOKEN_KEY = 'de_admin_token';
// Keep production connected to the project's Edge Function even when Netlify's
// build environment is missing the optional override.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://eoipbxzekrohgdcpqnpy.supabase.co/functions/v1').replace(/\/$/, '');
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const assetUrl = (path) => {
  if (!path || /^(https?:|data:|blob:)/i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (SUPABASE_PUBLISHABLE_KEY) headers.apikey = SUPABASE_PUBLISHABLE_KEY;
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : null;
  if (!res.ok) {
    if (res.status === 401 && token) setToken(null);
    throw new Error(data?.error || `Request failed (${res.status}).`);
  }
  if (data === null) throw new Error('The API returned a non-JSON response. Check the Supabase API URL and deployment settings.');
  return data;
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me'),
  listings: async (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
    const data = await request(`/api/listings${qs ? '?' + qs : ''}`);
    if (!Array.isArray(data)) throw new Error('The listings API returned an unexpected response.');
    return data;
  },
  listing: (id) => request(`/api/listings/${id}`),
  admin: {
    list: async () => {
      const data = await request('/api/admin/listings');
      if (!Array.isArray(data)) throw new Error('The admin listings API returned an unexpected response.');
      return data;
    },
    stats: () => request('/api/admin/listings/stats'),
    create: (b) => request('/api/admin/listings', { method: 'POST', body: b }),
    update: (id, b) => request(`/api/admin/listings/${id}`, { method: 'PUT', body: b }),
    remove: (id) => request(`/api/admin/listings/${id}`, { method: 'DELETE' }),
    dropPrice: (id, from, to) => request(`/api/admin/listings/${id}/drop-price`, { method: 'POST', body: { from, to } }),
    restorePrice: (id) => request(`/api/admin/listings/${id}/restore-price`, { method: 'POST' }),
    history: (id) => request(`/api/admin/listings/${id}/history`),
    upload: (files) => {
      return (async () => {
        const urls = [];
        for (const file of files) {
          const form = new FormData();
          form.append('images', file);
          const { urls: uploaded } = await request('/api/admin/listings/upload', { method: 'POST', form });
          urls.push(...uploaded);
        }
        return { urls };
      })();
    },
  },
};

export const CATEGORIES = [
  { key: 'land', label: 'Lands', icon: 'map' },
  { key: 'room', label: 'Rooms', icon: 'bed' },
  { key: 'rental', label: 'Rentals', icon: 'building' },
  { key: 'airbnb', label: 'Airbnb', icon: 'palmtree' },
];

export const fmt = (n, currency = 'UGX') => `${currency} ${Number(n).toLocaleString('en-UG', { maximumFractionDigits: 0 })}`;
export const unitLabel = (u) => (u === 'month' ? '/ month' : u === 'night' ? '/ night' : '');
export const percentOff = (orig, now) => (orig ? Math.round(((orig - now) / orig) * 100) : 0);
