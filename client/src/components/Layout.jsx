import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, MapPin, MessageCircle, ShieldCheck, LogOut, Menu, X, Mail } from 'lucide-react';
import { getToken, setToken } from '../api.js';
import { SITE, waLink } from '../config.js';

export default function Layout({ children }) {
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef(null);
  const loggedIn = !!getToken();
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>

      <header className="header">
        <div className="wrap header-inner">
          <Link to="/" className="brand" aria-label={`${SITE.name} home`} onClick={closeMenu}>
            <img className="brand-logo" src="/images/logo.png" alt="" />
            <div className="brand-name"><span>ASUMAN</span><small>Holdings</small></div>
          </Link>

          <button
            type="button"
            className="nav-toggle"
            ref={toggleRef}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="icon" /> : <Menu className="icon" />}
          </button>

          <nav id="primary-nav" className={`nav${menuOpen ? ' open' : ''}`} aria-label="Main">
            <a href="/#home" onClick={closeMenu}>Home</a>
            <a href="/#about" onClick={closeMenu}>About</a>
            <a href="/#services" onClick={closeMenu}>Services</a>
            <a href="/#listings" onClick={closeMenu}>Listings</a>
            <a href="/#gallery" onClick={closeMenu}>Gallery</a>
            <a href="/#testimonials" onClick={closeMenu}>Testimonials</a>
            <a href="/#contact" onClick={closeMenu}>Contact</a>
            {loggedIn ? (
              <>
                <Link to="/admin" className="admin-link" onClick={closeMenu}><ShieldCheck className="icon" /> Dashboard</Link>
                <button type="button" onClick={() => { setToken(null); closeMenu(); nav('/'); }}><LogOut className="icon" /> Sign out</button>
              </>
            ) : (
              <Link to="/admin/login" className="admin-link" onClick={closeMenu}><ShieldCheck className="icon" /> Admin</Link>
            )}
          </nav>
        </div>
      </header>

      <main id="main" className="wrap">{children}</main>

      <footer className="foot" id="site-footer">
        <div className="wrap">
          <div>
            <div className="brand" style={{ marginBottom: 12 }}>
              <img className="brand-logo" src="/images/logo.png" alt="" />
              <div className="brand-name"><span>ASUMAN</span><small>Holdings</small></div>
            </div>
            <p>Elegant homes, prime land, and thoughtful property care across {SITE.country}.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <a href="/#about">Our story</a>
            <a href="/#services">Services</a>
            <a href="/#listings">Featured properties</a>
            <a href="/#gallery">Gallery & tours</a>
          </div>
          <div>
            <h4>Contact</h4>
            <a href={`tel:${SITE.phoneTel}`}><Phone className="icon" /> {SITE.phoneDisplay}</a>
            <a href={waLink()} target="_blank" rel="noreferrer"><MessageCircle className="icon" /> WhatsApp</a>
            <a href={`mailto:${SITE.email}`}><Mail className="icon" /> {SITE.email}</a>
            <span className="foot-location"><MapPin className="icon" /> {SITE.office}</span>
          </div>
        </div>
        <div className="foot-bottom">
          <div className="wrap">
            <span>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</span>
            <span>{SITE.tagline}</span>
          </div>
        </div>
      </footer>

      <div className="fab-actions">
        <a className="fab fab-call" href={`tel:${SITE.phoneTel}`} aria-label={`Call ${SITE.phoneDisplay}`}>
          <Phone className="icon" /><span>Call</span>
        </a>
        <a className="fab fab-wa" href={waLink('Hello Asuman Holdings, I would like to enquire.')} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp">
          <MessageCircle className="icon" /><span>WhatsApp</span>
        </a>
      </div>
    </>
  );
}
