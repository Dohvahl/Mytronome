import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';

/** Footer control: shows the email when signed in, opens the account modal. */
export function AccountControl() {
  const { isAuthenticated, email } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="account-footer">
      {isAuthenticated && (
        <span className="account-email" title={email ?? ''}>
          {email}
        </span>
      )}
      <button
        type="button"
        className="account-button"
        onClick={() => setOpen(true)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
        Account
      </button>
      {open && <AccountModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function AccountModal({ onClose }: { onClose: () => void }) {
  const { isAuthenticated, email, signIn, register, signOut } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') await signIn(emailInput, password);
      else await register(emailInput, password);
      onClose(); // success → close the modal
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="account-backdrop" onClick={onClose}>
      <div
        className="account-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="account-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        {isAuthenticated ? (
          <div className="account-signed-in">
            <h3>Account</h3>
            <p className="account-status">
              Signed in as
              <br />
              <strong>{email}</strong>
            </p>
            <button
              type="button"
              className="auth-submit"
              onClick={() => {
                signOut();
                onClose();
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <form className="auth-panel" onSubmit={submit}>
            <h3>{mode === 'signin' ? 'Sign in' : 'Create account'}</h3>
            <p className="auth-prompt">Sign in to use server storage.</p>
            <input
              type="email"
              placeholder="Email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              autoComplete="email"
              maxLength={256}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              maxLength={128}
              required
            />
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
            <button
              type="button"
              className="auth-toggle"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
            >
              {mode === 'signin'
                ? 'Need an account? Create one'
                : 'Have an account? Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
