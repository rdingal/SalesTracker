import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';
import './LoginModal.css';

export default function LoginModal({ onClose }) {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email.trim() || !password) {
      setError('Please enter email and password.');
      return;
    }
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password);
        setMessage('Check your email to confirm your account, then sign in.');
        setIsSignUp(false);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="login-modal-title">
      <div className="login-modal-content" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="login-card">
          <h2 id="login-modal-title">Sign in to Koolet&apos;s</h2>
          <p className="login-subtitle">Inventory & Sales Tracker</p>
          <form onSubmit={handleSubmit} className="login-form">
            <label htmlFor="login-modal-email">Email</label>
            <input
              id="login-modal-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={submitting}
            />
            <label htmlFor="login-modal-password">Password</label>
            <input
              id="login-modal-password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={submitting}
            />
            {error && <p className="login-error" role="alert">{error}</p>}
            {message && <p className="login-message">{message}</p>}
            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? 'Please wait…' : isSignUp ? 'Sign up' : 'Sign in'}
            </button>
            <button
              type="button"
              className="login-toggle"
              onClick={() => {
                setIsSignUp((v) => !v);
                setError(null);
                setMessage(null);
              }}
              disabled={submitting}
            >
              {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
