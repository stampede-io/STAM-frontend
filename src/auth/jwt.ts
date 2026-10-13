/**
 * Decode the claims of a JWT without verifying its signature. The gateway has
 * already validated the token against identity's JWKS by the time the browser
 * holds it; the SPA only needs to read claims like `user_id`.
 */
export function decodeJwtClaims(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return {};
  }
}
