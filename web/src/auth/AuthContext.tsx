import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getAuthToken, setTokens } from './token';
import { loginRequest, registerRequest } from './authApi';

const EMAIL_KEY = 'mytronome.authEmail';

interface AuthValue {
  email: string | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Holds the signed-in state (token + email) and exposes sign-in/up/out. Because
 * it's React state, anything reading useAuth re-renders when auth changes — so
 * the Server storage option appears/disappears immediately on sign-in/out.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  const [email, setEmail] = useState<string | null>(() =>
    localStorage.getItem(EMAIL_KEY),
  );

  const value = useMemo<AuthValue>(() => {
    const apply = (
      accessToken: string | null,
      refreshToken: string | null,
      nextEmail: string | null,
    ) => {
      setTokens(accessToken, refreshToken);
      setToken(accessToken);
      if (nextEmail) localStorage.setItem(EMAIL_KEY, nextEmail);
      else localStorage.removeItem(EMAIL_KEY);
      setEmail(nextEmail);
    };

    return {
      email,
      isAuthenticated: token !== null,
      signIn: async (em, pw) => {
        const res = await loginRequest(em, pw);
        apply(res.accessToken, res.refreshToken, em);
      },
      register: async (em, pw) => {
        await registerRequest(em, pw);
        const res = await loginRequest(em, pw); // auto sign-in after registering
        apply(res.accessToken, res.refreshToken, em);
      },
      signOut: () => apply(null, null, null),
    };
  }, [token, email]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}
