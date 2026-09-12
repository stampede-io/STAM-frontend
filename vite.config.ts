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
      ...Object.fromEntries(
        ["/api", "/oauth2", "/login", "/.well-known"].map((path) => [
          path,
          { target: "http://localhost:8085", changeOrigin: true },
        ]),
      ),
    },
  },
});
