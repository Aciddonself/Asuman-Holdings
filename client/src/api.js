const TOKEN_KEY = 'de_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) setToken(null);
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/api/auth/me'),
  listings: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
    return request(`/api/listings${qs ? '?' + qs : ''}`);
  },
  listing: (id) => request(`/api/listings/${id}`),
  admin: {
    list: () => request('/api/admin/listings'),
    stats: () => request('/api/admin/listings/stats'),
    create: (b) => request('/api/admin/listings', { method: 'POST', body: b }),
    update: (id, b) => request(`/api/admin/listings/${id}`, { method: 'PUT', body: b }),
    remove: (id) => request(`/api/admin/listings/${id}`, { method: 'DELETE' }),
    dropPrice: (id, from, to) => request(`/api/admin/listings/${id}/drop-price`, { method: 'POST', body: { from, to } }),
    restorePrice: (id) => request(`/api/admin/listings/${id}/restore-price`, { method: 'POST' }),
    history: (id) => request(`/api/admin/listings/${id}/history`),
    upload: (files) => {
      const form = new FormData();
      [...files].forEach((f) => form.append('images', f));
      return request('/api/admin/listings/upload', { method: 'POST', form });
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
