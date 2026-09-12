import { AUTH_CONFIG } from "./config";

type TokenGetter = () => string | null;
type TokenSetter = (token: string | null) => void;
type LogoutFn = () => Promise<void>;

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(AUTH_CONFIG.refreshUrl, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token as string;
}

export type AuthFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function createAuthFetch(
  getToken: TokenGetter,
  setToken: TokenSetter,
  logout: LogoutFn,
) {
  return async function authFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const token = getToken();
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const res = await fetch(input, {
      ...init,
      headers,
      credentials: "include",
    });

    if (res.status !== 401) return res;

    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }

    const newToken = await refreshPromise;

    if (!newToken) {
      await logout();
      return res;
    }

    setToken(newToken);

    const retryHeaders = new Headers(init?.headers);
    retryHeaders.set("Authorization", `Bearer ${newToken}`);
    return fetch(input, {
      ...init,
      headers: retryHeaders,
      credentials: "include",
    });
  };
}
