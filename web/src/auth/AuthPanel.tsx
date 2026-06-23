import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthContext';

export function AuthPanel() {
  const { isAuthenticated, email, signIn, register, signOut } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    return (
      <div className="auth-panel auth-signed-in">
        <span className="auth-status">Signed in as {email}</span>
        <button type="button" className="auth-signout" onClick={signOut}>
          Sign out
        </button>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') await signIn(emailInput, password);
      else await register(emailInput, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-panel" onSubmit={submit}>
      <p className="auth-prompt">Sign in to use server storage.</p>
      <input
        type="email"
        placeholder="Email"
        value={emailInput}
        onChange={(e) => setEmailInput(e.target.value)}
        autoComplete="email"
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
  );
}
