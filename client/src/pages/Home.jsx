import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Building2, Camera, CheckCircle2, Compass,
  HeartHandshake, Mail, MapPin, MessageCircle, Phone, Play, Search,
  ShieldCheck, Sparkles, Tag,
} from 'lucide-react';
import { api, CATEGORIES } from '../api.js';
import { SITE, waLink } from '../config.js';
import ListingCard, { CatIcon } from '../components/ListingCard.jsx';

const photos = {
  green: '/images/property-green-courtyard.jpg',
  grey: '/images/property-grey-facade.jpg',
  beige: '/images/property-beige-courtyard.jpg',
};

const values = [
  { icon: ShieldCheck, title: 'Trust & Transparency', text: 'Clear deals, honest guidance, and documented processes on every property transaction.' },
  { icon: HeartHandshake, title: 'Client-Centric Care', text: 'From first inquiry to keys in hand, your goals shape every recommendation we make.' },
  { icon: CheckCircle2, title: 'Lasting Value', text: 'We focus on assets and rentals that grow wealth and lifestyle quality over time.' },
  { icon: Compass, title: 'Local Expertise', text: 'Deep knowledge of Uganda’s property market with standards that feel world-class.' },
];

const services = [
  { icon: Building2, title: 'Airbnb Rentals', image: photos.beige, text: 'Host-ready stays with listing optimization, guest care, cleaning coordination, and dynamic pricing.' },
  { icon: MapPin, title: 'Land Sales', image: photos.green, text: 'Verified plots in promising locations — guided due diligence so your investment stands on solid ground.' },
  { icon: Building2, title: 'Apartment Management', image: photos.grey, text: 'Tenant relations, maintenance, and rent collection handled so ownership stays stress-free.' },
  { icon: Compass, title: 'Property Consulting', image: photos.beige, text: 'Strategy for buying, renting, or scaling a portfolio with local insight and clear next steps.' },
];

const videoTours = [
  { title: 'Interior Living Tour', text: 'Step inside a welcoming, light-filled home.', src: 'https://videos.pexels.com/video-files/7578546/7578546-uhd_3840_2160_30fps.mp4', poster: photos.green },
  { title: 'Home Walkthrough', text: 'Explore a considered modern interior.', src: 'https://videos.pexels.com/video-files/10135086/10135086-uhd_3840_2160_30fps.mp4', poster: photos.beige },
  { title: 'Lifestyle Spaces', text: 'Take a closer look at the courtyard.', src: 'https://videos.pexels.com/video-files/32638428/13917643_3840_2160_30fps.mp4', poster: photos.green },
  { title: 'Modern Grey Suites', text: 'See the architecture and surroundings.', src: 'https://videos.pexels.com/video-files/18531410/18531410-uhd_3840_2160_60fps.mp4', poster: photos.grey },
];

const testimonials = [
  { quote: 'Asuman Holdings turned my apartment into a reliable short-stay income stream. Communication is clear and guests love the space.', name: 'Sarah Namukasa', role: 'Homeowner · Airbnb host' },
  { quote: 'The land process felt transparent from day one. I always knew the next step — rare in property deals.', name: 'Marcus Okello', role: 'Land investor' },
  { quote: 'Living in a managed Asuman property has been smooth. Maintenance is quick and the compound feels secure.', name: 'Elena Atim', role: 'Long-term tenant' },
];

export default function Home() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const drops = params.get('drops') === 'true';
  const [q, setQ] = useState(params.get('q') || '');
  const [max, setMax] = useState('');
  const [all, setAll] = useState([]);
  const [state, setState] = useState('loading');
  const [inquiry, setInquiry] = useState({ name: '', email: '', service: '', message: '' });
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    api.listings().then((data) => { setAll(data); setState('ready'); }).catch(() => setState('error'));
  }, []);

  const counts = useMemo(
    () => Object.fromEntries(CATEGORIES.map((item) => [item.key, all.filter((listing) => listing.category === item.key).length])),
    [all],
  );
  const dropped = useMemo(() => all.filter((listing) => listing.original_price), [all]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((listing) =>
      (!category || listing.category === category) &&
      (!drops || listing.original_price) &&
      (!term || `${listing.title} ${listing.location} ${listing.description}`.toLowerCase().includes(term)) &&
      (!max || Number(listing.price) <= Number(max))
    );
  }, [all, category, drops, q, max]);

  const toListings = (event) => {
    event.preventDefault();
    document.getElementById('listing-results')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  };

  const sendInquiry = (event) => {
    event.preventDefault();
    const text = [
      `Hello Asuman Holdings, my name is ${inquiry.name}.`,
      inquiry.email && `Email: ${inquiry.email}`,
      inquiry.service && `I am looking for: ${inquiry.service}`,
      inquiry.message && `Message: ${inquiry.message}`,
    ].filter(Boolean).join('\n');
    window.location.assign(waLink(text));
  };

  const selectedCategory = CATEGORIES.find((item) => item.key === category);
  const heading = drops ? 'Price drops' : selectedCategory?.label || 'Featured properties';

  return (
    <>
      <section className="home-hero" id="home" aria-labelledby="home-title">
        <div className="hero-copy">
          <div className="brand-pill">
            <img className="hero-logo" src="/images/logo.png" alt="Asuman Holdings" />
            <span className="eyebrow-gold"><Sparkles className="icon" /> {SITE.tagline}</span>
          </div>
          <h1 id="home-title">Find your dream property,<br /><em>land, AirBnB and/or rental</em></h1>
          <p className="hero-lead">
            Asuman Holdings brings elegance and trust to property in {SITE.country} — luxury apartments,
            prime land, Airbnb stays, and full-service management under one roof.
          </p>
          <div className="hero-actions">
            <a className="btn primary lg" href="#listings">Explore Properties <ArrowRight className="icon" /></a>
            <a className="btn whatsapp lg" href={waLink('Hello Asuman Holdings, I would like to enquire.')} target="_blank" rel="noreferrer">
              <MessageCircle className="icon" /> Chat on WhatsApp
            </a>
            <a className="btn dark lg" href={`tel:${SITE.phoneTel}`}><Phone className="icon" /> {SITE.phoneDisplay}</a>
          </div>
          <div className="hero-trust">
            <span><MapPin className="icon" /> Uganda & beyond</span>
            <a href="#gallery"><Play className="icon" /> Watch property tours</a>
          </div>
        </div>

        <div className="tour-stack">
          <div className="tour-card">
            <video
              autoPlay={!reducedMotion}
              muted
              loop={!reducedMotion}
              playsInline
              preload={reducedMotion ? 'none' : 'metadata'}
              poster={photos.green}
              aria-label="Property walkthrough by Asuman Holdings"
            >
              <source src={videoTours[0].src} type="video/mp4" />
            </video>
            <div className="tour-info">
              <span className="tour-label"><Play className="icon" /> Live tour</span>
              <h2>Step inside your next home</h2>
              <p>Property walkthrough · Asuman Holdings</p>
            </div>
          </div>
          <div className="tour-photos">
            <a className="tour-photo" href="#gallery">
              <img src={photos.grey} alt="Modern Grey Suites" loading="lazy" />
              <span>Modern Grey Suites</span>
            </a>
            <a className="tour-photo" href="#gallery">
              <img src={photos.beige} alt="Palm Court Homes" loading="lazy" />
              <span>Palm Court Homes</span>
            </a>
          </div>
        </div>
      </section>

      <section className="section-panel" id="about" aria-labelledby="about-title">
        <div className="story-grid">
          <div className="story-copy">
            <span className="kick">Our story</span>
            <h2 id="about-title">Property management with heart and polish</h2>
            <p>
              Asuman Holdings was built so finding a home, land, or investment feels inspiring — not overwhelming.
              We blend careful curation with hands-on management so every listing earns its place in your dream journey.
            </p>
            <p>
              Whether you need a short stay, a long-term rental, or acreage for the future, we open the door with
              professionalism you can feel.
            </p>
          </div>
          <div className="story-photos">
            <img src={photos.beige} alt="Palm Court apartments" loading="lazy" />
            <img src={photos.grey} alt="Modern grey apartments" loading="lazy" />
          </div>
        </div>
        <div className="values-grid">
          {values.map(({ icon: Icon, title, text }) => (
            <article className="value-card" key={title}>
              <div className="value-icon"><Icon className="icon" /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-panel" id="services" aria-labelledby="services-title">
        <div className="section-heading">
          <span className="kick">What we do</span>
          <h2 id="services-title">Tailored property solutions</h2>
          <p>One team for stays, land, apartments, and long-term care — designed around how you want to live and invest.</p>
        </div>
        <div className="service-grid">
          {services.map(({ icon: Icon, title, image, text }) => (
            <article className="service-card" key={title}>
              <img src={image} alt="" loading="lazy" />
              <div className="service-icon"><Icon className="icon" /></div>
              <h3>{title}</h3>
              <p>{text}</p>
              <a className="service-link" href={waLink(`Hello Asuman Holdings, I would like to ask about ${title}.`)} target="_blank" rel="noreferrer">
                <MessageCircle className="icon" /> Inquire on WhatsApp <ArrowRight className="icon" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="section-panel" id="listings" aria-labelledby="listings-title">
        <div className="section-heading">
          <span className="kick">{items.length} {items.length === 1 ? 'result' : 'results'}</span>
          <h2 id="listings-title">{heading}</h2>
          <p>Real Asuman Holdings properties — apartments and stays ready for your next chapter.</p>
        </div>

        <form className="listing-search" onSubmit={toListings} role="search">
          <div className="field">
            <label htmlFor="q">Where or what?</label>
            <input id="q" className="input" placeholder="Area, town or keyword" value={q} onChange={(event) => setQ(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cat">Property type</label>
            <select id="cat" className="select" value={category} onChange={(event) => setParam('category', event.target.value)}>
              <option value="">All types</option>
              {CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="max">Max price (UGX)</label>
            <input id="max" className="input" type="number" inputMode="numeric" min="0" placeholder="Any" value={max} onChange={(event) => setMax(event.target.value)} />
          </div>
          <button className="btn primary"><Search className="icon" /> Search</button>
        </form>

        <div className="chips" role="group" aria-label="Filter by category">
          <button className="chip" aria-pressed={!category} onClick={() => setParam('category', '')}>All</button>
          {CATEGORIES.map((item) => (
            <button key={item.key} className="chip" aria-pressed={category === item.key} onClick={() => setParam('category', item.key)}>
              <CatIcon cat={item.key} /> {item.label} · {counts[item.key] ?? 0}
            </button>
          ))}
          <button className="chip" aria-pressed={drops} onClick={() => setParam('drops', drops ? '' : 'true')}>
            <Tag className="icon" /> Price drops
          </button>
        </div>

        {dropped.length > 0 && !drops && (
          <div className="sec">
            <div className="sec-head">
              <div><span className="kick">Limited time</span><h2>Price drops</h2></div>
              <button className="btn ghost sm" onClick={() => setParam('drops', 'true')}><Tag className="icon" /> See all</button>
            </div>
            <div className="grid">
              {dropped.slice(0, 3).map((listing) => <ListingCard key={listing.id} l={listing} />)}
            </div>
          </div>
        )}

        <div id="listing-results" aria-live="polite" aria-atomic="false">
          {state === 'error' && <div className="notice err" style={{ marginTop: 18 }}>Couldn’t load listings. Please make sure the server is running.</div>}
          {state === 'loading' && <div className="empty" style={{ marginTop: 18 }}>Loading listings…</div>}
          {state === 'ready' && items.length === 0 && (
            <div className="empty" style={{ marginTop: 18 }}>
              No listings match yet. <a href={waLink('Hello Asuman Holdings, I am looking for a property.')} target="_blank" rel="noreferrer">Tell us what you need on WhatsApp</a>.
            </div>
          )}
          {state === 'ready' && items.length > 0 && <div className="grid">{items.map((listing) => <ListingCard key={listing.id} l={listing} />)}</div>}
        </div>
      </section>

      <section className="section-panel" id="gallery" aria-labelledby="gallery-title">
        <div className="section-heading">
          <span className="kick"><Camera className="icon" /> Gallery & tours</span>
          <h2 id="gallery-title">Step inside the portfolio</h2>
          <p>Photos from our properties plus immersive video tours — see the spaces before you visit.</p>
        </div>
        <div className="gallery-grid">
          <article className="gallery-card">
            <img src={photos.green} alt="Green Courtyard Residences" loading="lazy" />
            <div className="gallery-caption">Green Courtyard Residences<small>Secure compound · Family living</small></div>
          </article>
          <article className="gallery-card">
            <img src={photos.grey} alt="Modern Grey Suites" loading="lazy" />
            <div className="gallery-caption">Modern Grey Suites<small>Contemporary elevations · City edge</small></div>
          </article>
          <article className="gallery-card">
            <img src={photos.beige} alt="Palm Court Homes" loading="lazy" />
            <div className="gallery-caption">Palm Court Homes<small>Tropical courtyard · Everyday ease</small></div>
          </article>
          <article className="gallery-card">
            <video controls preload="none" poster={photos.green} aria-label="Property walkthrough video">
              <source src={videoTours[0].src} type="video/mp4" />
            </video>
            <div className="gallery-caption">Property walkthrough<small>Explore a home with Asuman Holdings</small></div>
          </article>
        </div>
        <div className="section-heading" style={{ marginTop: 32, marginBottom: 16 }}>
          <h3>Video tours</h3>
          <p>Watch living spaces and neighborhood context.</p>
        </div>
        <div className="video-grid">
          {videoTours.map((video) => (
            <article className="video-item" key={video.title}>
              <video controls preload="none" poster={video.poster} aria-label={video.title}>
                <source src={video.src} type="video/mp4" />
              </video>
              <h3>{video.title}</h3>
              <p>{video.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-panel" id="testimonials" aria-labelledby="testimonials-title">
        <div className="section-heading">
          <span className="kick">Client voices</span>
          <h2 id="testimonials-title">Trusted by dreamers & investors</h2>
        </div>
        <div className="testimonials-grid">
          {testimonials.map(({ quote, name, role }) => (
            <article className="quote-card" key={name}>
              <div className="quote-stars" aria-label="5 out of 5 stars">★★★★★</div>
              <blockquote>“{quote}”</blockquote>
              <div className="quote-author">
                <span className="quote-avatar" aria-hidden="true">{name[0]}</span>
                <span><strong>{name}</strong><small>{role}</small></span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-panel" id="contact" aria-labelledby="contact-title">
        <div className="contact-panel">
          <div className="contact-copy">
            <span className="kick">Get in touch</span>
            <h2 id="contact-title">Start your dream property journey</h2>
            <p>Call us directly or open a WhatsApp chat — we respond quickly on land, Airbnb, rentals, and management.</p>
            <div className="contact-list">
              <a href={`tel:${SITE.phoneTel}`}><span className="contact-icon"><Phone className="icon" /></span><span><small>Direct call</small><br />{SITE.phoneDisplay}</span></a>
              <a href={waLink()} target="_blank" rel="noreferrer"><span className="contact-icon"><MessageCircle className="icon" /></span><span><small>WhatsApp chat</small><br />Message {SITE.phoneDisplay}</span></a>
              <a href={`mailto:${SITE.email}`}><span className="contact-icon"><Mail className="icon" /></span><span><small>Email</small><br />{SITE.email}</span></a>
              <span><span className="contact-icon"><MapPin className="icon" /></span><span><small>Office</small><br />{SITE.office}</span></span>
            </div>
          </div>

          <form className="inquiry-form" onSubmit={sendInquiry}>
            <h3 className="full">Send a booking inquiry</h3>
            <p className="full">We’ll open WhatsApp with your details ready to send.</p>
            <div className="field">
              <label htmlFor="inquiry-name">Full name</label>
              <input id="inquiry-name" className="input" autoComplete="name" required value={inquiry.name} onChange={(event) => setInquiry({ ...inquiry, name: event.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="inquiry-email">Email</label>
              <input id="inquiry-email" className="input" type="email" autoComplete="email" value={inquiry.email} onChange={(event) => setInquiry({ ...inquiry, email: event.target.value })} />
            </div>
            <div className="field full">
              <label htmlFor="inquiry-service">I am looking for</label>
              <select id="inquiry-service" className="select" value={inquiry.service} onChange={(event) => setInquiry({ ...inquiry, service: event.target.value })}>
                <option value="">Select a service</option>
                <option>Airbnb Rental</option>
                <option>Land Purchase</option>
                <option>Apartment / Long-term Rental</option>
                <option>Property Management</option>
                <option>General Inquiry</option>
              </select>
            </div>
            <div className="field full">
              <label htmlFor="inquiry-message">Message</label>
              <textarea id="inquiry-message" className="textarea" rows="3" value={inquiry.message} onChange={(event) => setInquiry({ ...inquiry, message: event.target.value })} />
            </div>
            <button className="btn whatsapp"><MessageCircle className="icon" /> WhatsApp inquiry <ArrowRight className="icon" /></button>
          </form>
        </div>
      </section>
    </>
  );
}
