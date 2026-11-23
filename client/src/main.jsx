import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

class ApplicationBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Asuman Holdings page failed to render:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ maxWidth: 960, margin: '10vh auto', padding: 24, color: '#182b42' }}>
          <p style={{ color: '#86670e', fontWeight: 800, letterSpacing: '.12em' }}>ASUMAN HOLDINGS · UGANDA</p>
          <h1 style={{ fontSize: 'clamp(36px, 7vw, 64px)', lineHeight: 1.05 }}>Find your next home or investment.</h1>
          <p>Our property listings are temporarily unavailable. Contact our team and we’ll help you find an available property.</p>
          <p><a href="https://wa.me/256760790911">WhatsApp +256 760 790911</a> · <a href="mailto:hello@asumanholdings.com">hello@asumanholdings.com</a></p>
          <p><a href="/">Reload the website</a></p>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
const fallbackElement = document.getElementById('boot-fallback');
const fallbackObserver = new MutationObserver(() => {
  if (rootElement.childElementCount > 0) {
    fallbackElement?.remove();
    fallbackObserver.disconnect();
  }
});
fallbackObserver.observe(rootElement, { childList: true });

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ApplicationBoundary>
        <App />
      </ApplicationBoundary>
    </BrowserRouter>
  </React.StrictMode>
);
