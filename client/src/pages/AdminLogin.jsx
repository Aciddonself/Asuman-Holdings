import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { api, setToken } from '../api.js';

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const { token } = await api.login(email, password);
      setToken(token);
      nav('/admin');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <h1>Admin sign in</h1>
      <p>Manage lands, rooms, rentals and Airbnb listings for Asuman Holdings.</p>
      <form onSubmit={submit}>
        {err && <div className="notice err" role="alert">{err}</div>}
        <div className="field"><label htmlFor="em">Email</label>
          <input id="em" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="pw">Password</label>
          <input id="pw" className="input" type="password" autoComplete="current-password" maxLength={72} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn primary" disabled={busy}><LogIn className="icon" /> {busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
