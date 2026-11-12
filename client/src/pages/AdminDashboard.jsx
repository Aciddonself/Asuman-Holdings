import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Pencil, TrendingDown, Trash2, Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { api, getToken, CATEGORIES, fmt, unitLabel } from '../api.js';
import ListingForm from '../components/ListingForm.jsx';
import PriceDropModal from '../components/PriceDropModal.jsx';
import { CatIcon } from '../components/ListingCard.jsx';

export default function AdminDashboard() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);   // null | 'new' | listing
  const [dropping, setDropping] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [authed, setAuthed] = useState(!!getToken());

  const load = useCallback(() => {
    api.admin.list().then(setItems).catch((e) => {
      if (!getToken()) setAuthed(false); else setMsg({ type: 'err', text: e.message });
    });
  }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  if (!authed) return <Navigate to="/admin/login" replace />;

  const flash = (text, type = 'ok') => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000); };
  const rows = filter ? items.filter((l) => l.category === filter) : items;
  const count = (fn) => items.filter(fn).length;

  async function toggleStatus(l) {
    try {
      await api.admin.update(l.id, { status: l.status === 'available' ? 'taken' : 'available' });
      load();
    } catch (e) { flash(e.message, 'err'); }
  }
  async function remove(l) {
    if (!window.confirm(`Delete “${l.title}”? This cannot be undone.`)) return;
    try { await api.admin.remove(l.id); flash('Listing deleted.'); load(); } catch (e) { flash(e.message, 'err'); }
  }

  return (
    <section className="sec">
      <div className="sec-head">
        <div><span className="kick">Asuman Holdings</span><h2>Admin dashboard</h2></div>
        <span className="sec-kicker"><LayoutDashboard className="icon" /> Manage listings</span>
      </div>

      <div className="sec-body">
        <div className="stats">
          <div className="stat gold"><b>{items.length}</b><span>Total listings</span></div>
          <div className="stat dark"><b>{count((l) => l.status === 'available')}</b><span>Available</span></div>
          <div className="stat dark"><b>{count((l) => l.status === 'taken')}</b><span>Taken</span></div>
          <div className="stat gold"><b>{count((l) => l.original_price)}</b><span>Active price drops</span></div>
        </div>

        {msg.text && <div className={`notice ${msg.type}`} role="status" style={{ marginTop: 14 }}>{msg.text}</div>}

        <div className="toolbar-row">
          <div className="chips" role="group" aria-label="Filter category">
            <button className="chip" aria-pressed={!filter} onClick={() => setFilter('')}>All</button>
            {CATEGORIES.map((c) => (
              <button key={c.key} className="chip" aria-pressed={filter === c.key} onClick={() => setFilter(c.key)}><CatIcon cat={c.key} /> {c.label}</button>
            ))}
          </div>
          <button className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => setEditing('new')}><Plus className="icon" /> Add listing</button>
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Photo</th><th>Listing</th><th>Type</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 28 }}>No listings yet. Add your first one.</td></tr>}
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>{l.images[0] ? <img className="thumb" src={l.images[0]} alt="" /> : <div className="thumb" />}</td>
                  <td><strong>{l.title}</strong><br /><span style={{ fontSize: 12, color: 'var(--muted)' }}>{l.location}</span></td>
                  <td><span className="pill gold">{CATEGORIES.find((c) => c.key === l.category)?.label}</span></td>
                  <td>
                    <strong>{fmt(l.price, l.currency)}</strong> <small>{unitLabel(l.price_unit)}</small>
                    {l.original_price && <><br /><span className="was">{fmt(l.original_price, l.currency)}</span></>}
                  </td>
                  <td><span className={`pill ${l.status === 'available' ? 'ok' : 'bad'}`}>{l.status}</span></td>
                  <td>
                    <div className="row-actions">
                      <button className="btn dark sm" onClick={() => setEditing(l)} aria-label={`Edit ${l.title}`}><Pencil className="icon" /> Edit</button>
                      <button className="btn primary sm" onClick={() => setDropping(l)} aria-label={`Drop price of ${l.title}`}><TrendingDown className="icon" /> Price</button>
                      <button className="btn ghost sm" onClick={() => toggleStatus(l)} aria-label={l.status === 'available' ? 'Mark as taken' : 'Mark as available'}>
                        {l.status === 'available' ? <EyeOff className="icon" /> : <Eye className="icon" />}
                      </button>
                      <button className="btn danger sm" onClick={() => remove(l)} aria-label={`Delete ${l.title}`}><Trash2 className="icon" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <ListingForm
          listing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); flash('Listing saved.'); load(); }}
        />
      )}
      {dropping && (
        <PriceDropModal
          listing={dropping}
          onClose={() => setDropping(null)}
          onSaved={() => { setDropping(null); flash('Price updated.'); load(); }}
        />
      )}
    </section>
  );
}
