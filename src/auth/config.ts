export const AUTH_CONFIG = {
  // authorize is a top-level browser navigation straight to the Authorization
  // Server (via the gateway's /oauth2/** route). token/refresh/logout go to the
  // gateway BFF, which keeps the refresh token in an httpOnly cookie (ADR-0005).
  authorizeUrl:
    import.meta.env.VITE_AUTH_AUTHORIZE_URL ?? "/oauth2/authorize",
  tokenUrl: import.meta.env.VITE_AUTH_TOKEN_URL ?? "/api/v1/oauth2/token",
  refreshUrl: import.meta.env.VITE_AUTH_REFRESH_URL ?? "/api/v1/oauth2/refresh",
  logoutUrl: import.meta.env.VITE_AUTH_LOGOUT_URL ?? "/api/v1/oauth2/logout",
  clientId: import.meta.env.VITE_AUTH_CLIENT_ID ?? "stampede-spa",
  redirectUri:
    import.meta.env.VITE_AUTH_REDIRECT_URI ??
    `${window.location.origin}/auth/callback`,
  // offline_access is required — identity only issues a refresh token (the
  // thing the BFF puts in the httpOnly cookie) when it's requested. Without
  // it, tryRefresh() on mount always 401s and every page reload logs out.
  scope: "openid profile email offline_access",
} as const;
