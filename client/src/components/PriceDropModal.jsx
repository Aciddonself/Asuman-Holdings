import { useEffect, useState } from 'react';
import { X, TrendingDown, Undo2 } from 'lucide-react';
import { api, fmt, percentOff } from '../api.js';

export default function PriceDropModal({ listing, onClose, onSaved }) {
  // "From" defaults to the original price if a drop is active, else the current price.
  const [from, setFrom] = useState(Number(listing.original_price ?? listing.price));
  const [to, setTo] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState([]);

  useEffect(() => { api.admin.history(listing.id).then(setHist).catch(() => {}); }, [listing.id]);

  const valid = Number(to) >= 0 && to !== '' && Number(to) < Number(from);

  async function run(fn) {
    setBusy(true); setErr('');
    try { onSaved(await fn()); } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="pd-title">
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-head"><span id="pd-title">Drop price</span>
          <button type="button" onClick={onClose} aria-label="Close"><X className="icon" /></button></div>
        <div className="modal-body">
          <strong>{listing.title}</strong>
          {err && <div className="notice err" role="alert">{err}</div>}
          <div className="form-grid">
            <div className="field"><label htmlFor="pf">Drop from ({listing.currency})</label>
              <input id="pf" className="input" type="number" min="0" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field"><label htmlFor="pt">Drop to ({listing.currency})</label>
              <input id="pt" className="input" type="number" min="0" value={to} onChange={(e) => setTo(e.target.value)} autoFocus /></div>
          </div>
          {valid && (
            <div className="preview-drop">
              <span className="was">{fmt(from, listing.currency)}</span>
              <strong>{fmt(to, listing.currency)}</strong>
              <span className="off">-{percentOff(Number(from), Number(to))}%</span>
            </div>
          )}
          {hist.length > 0 && (
            <div>
              <span className="mini-h">Price history</span>
              <ul className="hist">
                {hist.slice(0, 6).map((h) => (
                  <li key={h.id}><span>{new Date(h.changed_at).toLocaleDateString()} · {h.kind}</span>
                    <span>{fmt(h.old_price)} → {fmt(h.new_price)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="modal-foot">
          {listing.original_price && (
            <button className="btn ghost" disabled={busy} onClick={() => run(() => api.admin.restorePrice(listing.id))}>
              <Undo2 className="icon" /> Restore {fmt(listing.original_price, listing.currency)}
            </button>
          )}
          <button className="btn primary" disabled={!valid || busy} onClick={() => run(() => api.admin.dropPrice(listing.id, Number(from), Number(to)))}>
            <TrendingDown className="icon" /> Apply price drop
          </button>
        </div>
      </div>
    </div>
  );
}
