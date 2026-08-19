# STAM-frontend

[![CI](https://github.com/stampede-io/STAM-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/stampede-io/STAM-frontend/actions/workflows/ci.yml)

React + Vite + TS SPA — seat-map, checkout, PKCE auth.

## Authentication

The SPA uses OAuth 2.0 with PKCE (RFC 7636) for public-client authentication against `STAM-identity`.

### Token storage

- **Access token**: held in React Context (`AuthProvider`) — never written to `localStorage` or `sessionStorage`, so it's inaccessible to XSS.
- **Refresh token**: delivered as an `httpOnly` cookie by the authorization server. The SPA never reads it directly; it sends `credentials: "include"` to the refresh endpoint and receives a new access token in the JSON response body.

### Login flow

1. User clicks **Log in** — the app generates a PKCE code verifier (32 random bytes, base64url) and S256 code challenge via Web Crypto, stores the verifier in `sessionStorage`, and redirects to the authorize endpoint.
2. After consent, the authorization server redirects to `/auth/callback?code=...&state=...`.
3. `AuthCallbackPage` validates the `state` parameter, exchanges the authorization code + verifier for tokens at the token endpoint, stores the access token in context, and navigates to `/`.

### Silent refresh

On every mount, `AuthProvider` attempts a `POST /api/v1/oauth2/refresh` with `credentials: "include"`. If the httpOnly cookie is valid, the server returns a fresh access token and the user stays logged in without re-authenticating.

### Authenticated API calls

`createAuthFetch` (`src/auth/authFetch.ts`) wraps `fetch` to:

1. Attach a `Bearer` token from `getAccessToken()`.
2. On a `401` response, call the refresh endpoint once (deduplicating concurrent attempts) and retry with the new token.
3. If refresh fails, call `logout()` to clear state.

### Cross-tab logout

When any tab logs out, it writes and immediately removes a `stampede_logout` key in `localStorage`. Other tabs detect this via the `StorageEvent` listener in `AuthProvider` and clear their own auth state.

### Environment overrides

All auth endpoints and the client ID can be overridden via Vite env vars:

| Variable | Default |
|----------|---------|
| `VITE_AUTH_AUTHORIZE_URL` | `/api/v1/oauth2/authorize` |
| `VITE_AUTH_TOKEN_URL` | `/api/v1/oauth2/token` |
| `VITE_AUTH_REFRESH_URL` | `/api/v1/oauth2/refresh` |
| `VITE_AUTH_LOGOUT_URL` | `/api/v1/oauth2/logout` |
| `VITE_AUTH_CLIENT_ID` | `stampede-spa` |
| `VITE_AUTH_REDIRECT_URI` | `${origin}/auth/callback` |
