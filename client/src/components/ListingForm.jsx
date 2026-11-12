import { useState } from 'react';
import { X, ImagePlus, Save } from 'lucide-react';
import { api, assetUrl, CATEGORIES } from '../api.js';
import { useDialog } from '../hooks/useDialog.js';

const blank = {
  category: 'land', title: '', description: '', location: '', price: '', price_unit: 'total',
  currency: 'UGX', size: '', bedrooms: '', bathrooms: '', amenities: '', images: [], status: 'available', featured: false,
};

export default function ListingForm({ listing, onClose, onSaved }) {
  const [f, setF] = useState(listing ? { ...listing, amenities: listing.amenities.join(', '), bedrooms: listing.bedrooms ?? '', bathrooms: listing.bathrooms ?? '', price: Number(listing.price) } : blank);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const dialogRef = useDialog(onClose, busy);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  // Sensible default unit when the category changes (new listings only).
  const setCategory = (e) => {
    const category = e.target.value;
    const price_unit = listing ? f.price_unit : { land: 'total', room: 'month', rental: 'month', airbnb: 'night' }[category];
    setF({ ...f, category, price_unit });
  };

  async function upload(e) {
    if (!e.target.files.length) return;
    setBusy(true); setErr('');
    try {
      const { urls } = await api.admin.upload(e.target.files);
      setF((s) => ({ ...s, images: [...s.images, ...urls] }));
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
    e.target.value = '';
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const body = { ...f, price: Number(f.price) };
      const saved = listing ? await api.admin.update(listing.id, body) : await api.admin.create(body);
      onSaved(saved);
    } catch (ex) { setErr(ex.message); setBusy(false); }
  }

  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="lf-title">
      <form ref={dialogRef} className="modal" tabIndex="-1" onSubmit={submit}>
        <div className="modal-head"><span id="lf-title">{listing ? 'Edit listing' : 'New listing'}</span>
          <button type="button" onClick={onClose} aria-label="Close"><X className="icon" /></button></div>
        <div className="modal-body">
          {err && <div className="notice err" role="alert">{err}</div>}
          <div className="form-grid">
            <div className="field"><label htmlFor="cat">Category</label>
              <select id="cat" className="select" value={f.category} onChange={setCategory}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select></div>
            <div className="field"><label htmlFor="st">Status</label>
              <select id="st" className="select" value={f.status} onChange={set('status')}>
                <option value="available">Available</option><option value="taken">Taken / unavailable</option>
              </select></div>
            <div className="field full"><label htmlFor="ti">Title</label>
              <input id="ti" className="input" required value={f.title} onChange={set('title')} /></div>
            <div className="field full"><label htmlFor="lo">Location</label>
              <input id="lo" className="input" value={f.location} onChange={set('location')} placeholder="Area, city" /></div>
            <div className="field"><label htmlFor="pr">Price</label>
              <input id="pr" className="input" type="number" min="0" step="1" required value={f.price} onChange={set('price')} /></div>
            <div className="field"><label htmlFor="pu">Price is</label>
              <select id="pu" className="select" value={f.price_unit} onChange={set('price_unit')}>
                <option value="total">One-off total</option><option value="month">Per month</option><option value="night">Per night</option>
              </select></div>
            <div className="field"><label htmlFor="sz">Size</label>
              <input id="sz" className="input" value={f.size} onChange={set('size')} placeholder="e.g. 50 x 100 ft, 2 acres" /></div>
            <div className="field"><label htmlFor="cu">Currency</label>
              <input id="cu" className="input" value={f.currency} onChange={set('currency')} /></div>
            {f.category !== 'land' && (
              <>
                <div className="field"><label htmlFor="bd">Bedrooms</label>
                  <input id="bd" className="input" type="number" min="0" value={f.bedrooms} onChange={set('bedrooms')} /></div>
                <div className="field"><label htmlFor="ba">Bathrooms</label>
                  <input id="ba" className="input" type="number" min="0" value={f.bathrooms} onChange={set('bathrooms')} /></div>
                <div className="field full"><label htmlFor="am">Amenities (comma separated)</label>
                  <input id="am" className="input" value={f.amenities} onChange={set('amenities')} placeholder="Wi-Fi, Parking, Security" /></div>
              </>
            )}
            <div className="field full"><label htmlFor="de">Description</label>
              <textarea id="de" className="textarea" value={f.description} onChange={set('description')} /></div>
          </div>

          <div className="field"><label htmlFor="im">Photos</label>
            <div className="img-grid">
              {f.images.map((src) => (
                <div className="img-item" key={src}>
                  <img src={assetUrl(src)} alt="" />
                  <button type="button" aria-label="Remove photo" onClick={() => setF({ ...f, images: f.images.filter((x) => x !== src) })}><X className="icon" /></button>
                </div>
              ))}
            </div>
            <label className="btn ghost sm" style={{ alignSelf: 'flex-start', marginTop: 6 }} htmlFor="im">
              <ImagePlus className="icon" /> {busy ? 'Uploading…' : 'Add photos'}
            </label>
            <input id="im" type="file" accept="image/*" multiple hidden onChange={upload} />
          </div>
          <label className="check"><input type="checkbox" checked={f.featured} onChange={set('featured')} /> Feature this listing on top</label>
          {listing && listing.original_price && <p className="notice ok" style={{ margin: 0 }}>A price drop is active. Changing the price here ends it — use “Drop price” to adjust it instead.</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}><Save className="icon" /> Save listing</button>
        </div>
      </form>
    </div>
  );
}
