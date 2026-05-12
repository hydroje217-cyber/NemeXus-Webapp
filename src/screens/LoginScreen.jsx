import { useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

function BrandLockup({ title, subtitle }) {
  return (
    <div className="brand-lockup">
      <span className="brand-mark">
        <img src="/nemexus-logo.png" alt="NemeXus logo" />
      </span>
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

export default function LoginScreen({ message, onMessage }) {
  const [email, setEmail] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return window.localStorage.getItem('nemexus-last-email') || '';
  });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef(null);

  function normalizeEmail(value) {
    const trimmed = value.trim();
    return trimmed && !trimmed.includes('@') ? `${trimmed}@gmail.com` : trimmed;
  }

  function getFriendlyAuthMessage(error) {
    const messageText = error?.message || '';
    const lowerMessage = messageText.toLowerCase();

    if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('network')) {
      return 'Could not reach Supabase. Check the project URL, anon key, and internet connection.';
    }

    if (lowerMessage.includes('invalid login') || lowerMessage.includes('invalid credentials')) {
      return 'Invalid email or password.';
    }

    if (lowerMessage.includes('email not confirmed')) {
      return 'This account still needs email confirmation before signing in.';
    }

    return messageText || 'Sign in failed.';
  }

  function handleEmailKeyDown(event) {
    if (event.key !== 'Enter') {
      return;
    }

    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail !== email) {
      event.preventDefault();
      setEmail(normalizedEmail);
      passwordInputRef.current?.focus();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(email);
    setEmail(normalizedEmail);
    setBusy(true);
    setCheckingAccess(false);
    onMessage('');

    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

    if (error) {
      onMessage(getFriendlyAuthMessage(error));
      setCheckingAccess(false);
      setBusy(false);
      return;
    } else if (typeof window !== 'undefined') {
      window.localStorage.setItem('nemexus-last-email', normalizedEmail);
    }

    setCheckingAccess(true);
    onMessage('Checking access...');
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <BrandLockup title="NemeXus Dashboard" subtitle="Manager and supervisor access" />

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="text"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={handleEmailKeyDown}
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <div className="password-input-wrap">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-visibility-button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {message ? <p className="form-message">{message}</p> : null}

          <button type="submit" disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : <ShieldCheck size={16} />}
            {checkingAccess ? 'Checking access...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
