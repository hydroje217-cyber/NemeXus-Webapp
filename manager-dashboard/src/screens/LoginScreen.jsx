import { useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

const REQUEST_ROLE_OPTIONS = ['operator', 'manager', 'supervisor', 'general_manager'];

const ROLE_LABELS = {
  operator: 'operator',
  manager: 'manager',
  supervisor: 'supervisor',
  general_manager: 'general manager',
};

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
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [requestedRole, setRequestedRole] = useState('manager');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    onMessage('');

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: requestedRole,
            requested_role: requestedRole,
          },
        },
      });

      if (error) {
        onMessage(error.message || 'Access request failed.');
        setBusy(false);
        return;
      }

      if (data.user) {
        await supabase
          .from('profiles')
          .upsert(
            {
              id: data.user.id,
              email: data.user.email || email,
              full_name: fullName.trim(),
              role: requestedRole,
              is_active: true,
              is_approved: false,
            },
            { onConflict: 'id' }
          );
      }

      await supabase.auth.signOut();
      setPassword('');
      setMode('signin');
      onMessage('Access request sent. An admin can approve it from Account Approvals.');
      setBusy(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      onMessage(error.message || 'Sign in failed.');
    }

    setBusy(false);
  }

  function handleModeToggle() {
    setMode((currentMode) => (currentMode === 'signup' ? 'signin' : 'signup'));
    onMessage('');
  }

  async function handlePasswordReset() {
    const resetEmail = email.trim();

    if (!resetEmail) {
      onMessage('Enter your email address first.');
      return;
    }

    setBusy(true);
    onMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    });

    onMessage(error ? error.message || 'Failed to send reset email.' : 'Password reset email sent.');
    setBusy(false);
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <BrandLockup
          title="NemeXus Dashboard"
          subtitle={mode === 'signup' ? 'Request dashboard access' : 'Manager and supervisor access'}
        />

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === 'signup' ? (
            <label>
              <span>Full name</span>
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
            <span>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span className="login-label-row">
              Password
              {mode === 'signin' ? (
                <button type="button" className="forgot-password-button" onClick={handlePasswordReset} disabled={busy}>
                  Forgot Password?
                </button>
              ) : null}
            </span>
            <span className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                required
              />
              <button
                type="button"
                className="password-visibility-button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((isShown) => !isShown)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </label>

          {mode === 'signup' ? (
            <label>
              <span>Access level</span>
              <select value={requestedRole} onChange={(event) => setRequestedRole(event.target.value)} required>
                {REQUEST_ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role] || role}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {message ? <p className="form-message">{message}</p> : null}

          <button type="submit" className="login-submit-button" disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : mode === 'signup' ? <UserPlus size={16} /> : <ShieldCheck size={16} />}
            {mode === 'signup' ? 'Send request' : 'Sign in'}
          </button>

          <p className="login-switch-copy">
            {mode === 'signup' ? 'Already have an account?' : 'No account?'}
            <button type="button" className="login-mode-switch" onClick={handleModeToggle}>
              {mode === 'signup' ? 'Sign in' : 'Request access'}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
