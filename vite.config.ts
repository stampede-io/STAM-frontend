import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Everything the SPA sends to a backend goes through the gateway on :8085.
      // /api        — REST + the BFF token handler (/api/v1/oauth2/*)
      // /oauth2     — Spring Authorization Server (authorize endpoint, top-level nav)
      // /login      — identity's login form (part of the authorize redirect)
      // /.well-known — OIDC discovery / JWKS
      //
      // No changeOrigin: identity builds its /login and post-authorize
      // redirects from the Host it sees (via the gateway's PreserveHostHeader
      // filter — see the STAM-gateway PR). changeOrigin would rewrite that to
      // localhost:8085 instead of the dev server's own origin, the same class
      // of bug nginx.conf's $http_host (not $host) fix avoids in compose.
      ...Object.fromEntries(
        ["/api", "/oauth2", "/login", "/.well-known"].map((path) => [
          path,
          { target: "http://localhost:8085" },
        ]),
      ),
    },
  },
});
