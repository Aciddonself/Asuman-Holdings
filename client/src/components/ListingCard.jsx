import { Link } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Ruler, Map, Building2, Palmtree } from 'lucide-react';
import { fmt, unitLabel, percentOff, CATEGORIES } from '../api.js';

export const CatIcon = ({ cat, ...p }) => {
  const C = { land: Map, room: BedDouble, rental: Building2, airbnb: Palmtree }[cat] || Map;
  return <C className="icon" {...p} />;
};

export function Price({ l }) {
  return (
    <div className="price-row">
      <span className="price">{fmt(l.price, l.currency)} <small>{unitLabel(l.price_unit)}</small></span>
      {l.original_price && (
        <>
          <span className="was"><span className="sr-only">Was </span>{fmt(l.original_price, l.currency)}</span>
          <span className="off">-{percentOff(l.original_price, l.price)}%</span>
        </>
      )}
    </div>
  );
}

export default function ListingCard({ l }) {
  const label = CATEGORIES.find((c) => c.key === l.category)?.label;
  return (
    <Link to={`/listing/${l.id}`} className="card">
      <div className="card-img">
        {l.images[0] ? <img src={l.images[0]} alt={l.title} loading="lazy" /> : <CatIcon cat={l.category} />}
        <span className="tag"><CatIcon cat={l.category} /> {label}</span>
        {l.original_price && <span className="tag drop">Price drop</span>}
        {l.status === 'taken' && <span className="tag taken">Taken</span>}
      </div>
      <div className="card-body">
        <h3>{l.title}</h3>
        <div className="loc"><MapPin className="icon" /> {l.location || 'Location on request'}</div>
        <div className="meta">
          {l.size && <span><Ruler className="icon" /> {l.size}</span>}
          {l.bedrooms != null && <span><BedDouble className="icon" /> {l.bedrooms}</span>}
          {l.bathrooms != null && <span><Bath className="icon" /> {l.bathrooms}</span>}
        </div>
        <Price l={l} />
      </div>
    </Link>
  );
}
