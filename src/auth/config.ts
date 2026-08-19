export const AUTH_CONFIG = {
  authorizeUrl:
    import.meta.env.VITE_AUTH_AUTHORIZE_URL ?? "/api/v1/oauth2/authorize",
  tokenUrl: import.meta.env.VITE_AUTH_TOKEN_URL ?? "/api/v1/oauth2/token",
  refreshUrl: import.meta.env.VITE_AUTH_REFRESH_URL ?? "/api/v1/oauth2/refresh",
  logoutUrl: import.meta.env.VITE_AUTH_LOGOUT_URL ?? "/api/v1/oauth2/logout",
  clientId: import.meta.env.VITE_AUTH_CLIENT_ID ?? "stampede-spa",
  redirectUri:
    import.meta.env.VITE_AUTH_REDIRECT_URI ??
    `${window.location.origin}/auth/callback`,
  scope: "openid profile email",
} as const;
