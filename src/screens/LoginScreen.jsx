import { useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { recordAccountLogin, updateAccountPresence } from '../services/dashboard';

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
  const [authMode, setAuthMode] = useState('login');
  const [fullName, setFullName] = useState('');
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
  const isSignUp = authMode === 'signup';

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

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        onMessage(getFriendlyAuthMessage(error));
        setBusy(false);
        return;
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('nemexus-last-email', normalizedEmail);
      }

      setPassword('');
      setAuthMode('login');
      onMessage('Account requested. Check your email, then wait for dashboard approval.');
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

    if (error) {
      onMessage(getFriendlyAuthMessage(error));
      setCheckingAccess(false);
      setBusy(false);
      return;
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem('nemexus-last-email', normalizedEmail);

      try {
        await recordAccountLogin({ userAgent: window.navigator.userAgent });
        await updateAccountPresence({ userAgent: window.navigator.userAgent });
      } catch (error) {
        console.warn('Failed to record login activity.', error);
      }
    }

    setCheckingAccess(true);
    onMessage('Checking access...');
  }

  function handleForgotPasswordOpen() {
    const normalizedEmail = normalizeEmail(email);
    setEmail(normalizedEmail);
    setCheckingAccess(false);
    onMessage('Ask an admin to set a new password for your account.');
  }

  function handleModeChange(nextMode) {
    setAuthMode(nextMode);
    setPassword('');
    setCheckingAccess(false);
    onMessage('');
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <header className="login-hero">
          <BrandLockup title="NemeXus" subtitle="Manager, supervisor, general manager, and admin access" />
          <div className="login-welcome">
            <h2>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
            <p>{isSignUp ? 'Request dashboard access' : 'Live Supabase workspace'}</p>
          </div>
        </header>

        <form className="login-form" onSubmit={handleSubmit}>
          {isSignUp ? (
            <label>
              Full name
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
          ) : null}

          <label>
            Email address
            <input
              type="text"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={handleEmailKeyDown}
              autoComplete="email"
              placeholder="e.g. name@gmail.com"
              required
            />
          </label>

          <label>
            <span className="login-label-row">
              Password
              {!isSignUp ? (
                <button type="button" className="text-action" onClick={handleForgotPasswordOpen} disabled={busy}>
                  Forgot password?
                </button>
              ) : null}
            </span>
            <div className="password-input-wrap">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
                minLength={isSignUp ? 6 : undefined}
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

          <button type="submit" className="login-submit-button" disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : isSignUp ? <UserPlus size={16} /> : <ShieldCheck size={16} />}
            {checkingAccess ? 'Checking access...' : isSignUp ? 'Sign up' : 'Log in'}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? 'Already have an account?' : 'No account?'}
          <button
            type="button"
            className="text-action"
            onClick={() => handleModeChange(isSignUp ? 'login' : 'signup')}
            disabled={busy}
          >
            {isSignUp ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </section>
    </main>
  );
}
