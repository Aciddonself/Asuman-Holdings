import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Ruler, BedDouble, Bath, Phone, MessageCircle, Info } from 'lucide-react';
import { api, assetUrl, CATEGORIES, percentOff, fmt, unitLabel } from '../api.js';
import { SITE, waLink } from '../config.js';
import { CatIcon, Price } from '../components/ListingCard.jsx';

export default function ListingDetail() {
  const { id } = useParams();
  const [l, setL] = useState(null);
  const [err, setErr] = useState('');
  const [i, setI] = useState(0);

  useEffect(() => {
    let active = true;
    setL(null);
    setErr('');
    setI(0);
    api.listing(id).then((listing) => { if (active) setL(listing); }).catch((e) => { if (active) setErr(e.message); });
    return () => { active = false; };
  }, [id]);

  if (err) return <div className="notice err" style={{ marginTop: 28 }}>{err} <Link to="/">Back to listings</Link></div>;
  if (!l) return <div className="empty" style={{ marginTop: 28 }}>Loading…</div>;

  const label = CATEGORIES.find((c) => c.key === l.category)?.label;
  const msg = `Hello Asuman Holdings, I'm interested in "${l.title}" (#${l.id}) — ${fmt(l.price, l.currency)} ${unitLabel(l.price_unit)}.`;

  return (
    <section className="sec" style={{ paddingTop: 24 }}>
      <Link to="/" className="btn ghost sm"><ArrowLeft className="icon" /> All listings</Link>
      <div className="sec-head" style={{ marginTop: 18 }}>
        <div>
          <span className="kick"><CatIcon cat={l.category} /> {label}</span>
          <h2>{l.title}</h2>
          <div className="loc" style={{ marginTop: 6 }}><MapPin className="icon" /> {l.location || 'Location on request'}</div>
        </div>
      </div>

      <div className="detail">
        <div>
          <div className="gallery-main">
            {l.images[i] ? <img src={assetUrl(l.images[i])} alt={`${l.title} — photo ${i + 1}`} /> : <CatIcon cat={l.category} style={{ width: 64, height: 64 }} />}
          </div>
          {l.images.length > 1 && (
            <div className="thumbs">
              {l.images.map((src, n) => (
                <button key={src} aria-label={`Show photo ${n + 1}`} aria-current={n === i} onClick={() => setI(n)}><img src={assetUrl(src)} alt="" /></button>
              ))}
            </div>
          )}
          <div className="blk" style={{ marginTop: 20 }}>
            <h4><Info className="icon" /> About this place</h4>
            <p>{l.description || 'Contact us for more details.'}</p>
          </div>
        </div>

        <div className="stack">
          <div className="visa-box">
            {l.original_price && <span className="off" style={{ alignSelf: 'flex-start' }}>Price drop · -{percentOff(l.original_price, l.price)}%</span>}
            <Price l={l} />
            {l.original_price && <p style={{ color: 'var(--ok)', fontWeight: 700 }}>You save {fmt(l.original_price - l.price, l.currency)}</p>}
            {l.status === 'taken' && <span className="pill bad" style={{ alignSelf: 'flex-start' }}>No longer available</span>}
            <div className="cta-row">
              <a className="btn wa" href={waLink(msg)} target="_blank" rel="noreferrer"><MessageCircle className="icon" /> WhatsApp</a>
              <a className="btn dark" href={`tel:${SITE.phoneTel}`}><Phone className="icon" /> Call</a>
            </div>
          </div>
          <div className="chips">
            {l.size && <span className="chip"><Ruler className="icon" /> {l.size}</span>}
            {l.bedrooms != null && <span className="chip"><BedDouble className="icon" /> {l.bedrooms} bed</span>}
            {l.bathrooms != null && <span className="chip"><Bath className="icon" /> {l.bathrooms} bath</span>}
          </div>
          {l.amenities.length > 0 && (
            <div><span className="mini-h">Amenities</span>
              <div className="amen">{l.amenities.map((a) => <span key={a} className="chip">{a}</span>)}</div></div>
          )}
          <div className="blk dark">
            <h4><Phone className="icon" /> Want to view it?</h4>
            <p>Call or WhatsApp {SITE.phoneDisplay} and mention listing #{l.id}.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
