import {
  createContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { generateCodeVerifier, generateCodeChallenge } from "./pkce";
import { AUTH_CONFIG } from "./config";

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  handleCallback: (code: string, state: string) => Promise<void>;
  getAccessToken: () => string | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const VERIFIER_KEY = "pkce_code_verifier";
const STATE_KEY = "pkce_state";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    accessToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const tryRefresh = useCallback(async () => {
    try {
      const res = await fetch(AUTH_CONFIG.refreshUrl, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.access_token as string;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    tryRefresh().then((token) => {
      if (cancelled) return;
      if (token) {
        setAuth({ accessToken: token, isAuthenticated: true, isLoading: false });
      } else {
        setAuth({ accessToken: null, isAuthenticated: false, isLoading: false });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tryRefresh]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "stampede_logout") {
        setAuth({ accessToken: null, isAuthenticated: false, isLoading: false });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback(async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = generateCodeVerifier();

    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: AUTH_CONFIG.clientId,
      redirect_uri: AUTH_CONFIG.redirectUri,
      scope: AUTH_CONFIG.scope,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
    });

    window.location.href = `${AUTH_CONFIG.authorizeUrl}?${params}`;
  }, []);

  const handleCallback = useCallback(
    async (code: string, state: string) => {
      const savedState = sessionStorage.getItem(STATE_KEY);
      if (state !== savedState) {
        throw new Error("State mismatch — possible CSRF attack");
      }

      const verifier = sessionStorage.getItem(VERIFIER_KEY);
      if (!verifier) {
        throw new Error("Missing PKCE verifier");
      }

      sessionStorage.removeItem(VERIFIER_KEY);
      sessionStorage.removeItem(STATE_KEY);

      const res = await fetch(AUTH_CONFIG.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        credentials: "include",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: AUTH_CONFIG.redirectUri,
          client_id: AUTH_CONFIG.clientId,
          code_verifier: verifier,
        }),
      });

      if (!res.ok) {
        throw new Error(`Token exchange failed: ${res.status}`);
      }

      const data = await res.json();
      setAuth({
        accessToken: data.access_token,
        isAuthenticated: true,
        isLoading: false,
      });
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await fetch(AUTH_CONFIG.logoutUrl, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // best-effort server logout
    }

    setAuth({ accessToken: null, isAuthenticated: false, isLoading: false });
    localStorage.setItem("stampede_logout", Date.now().toString());
    localStorage.removeItem("stampede_logout");
  }, []);

  const getAccessToken = useCallback(() => auth.accessToken, [auth.accessToken]);

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        login,
        logout,
        handleCallback,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

