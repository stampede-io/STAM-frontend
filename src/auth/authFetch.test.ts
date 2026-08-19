import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAuthFetch } from "./authFetch";

const originalFetch = globalThis.fetch;

describe("createAuthFetch", () => {
  let getToken: () => string | null;
  let setToken: ReturnType<typeof vi.fn>;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getToken = () => "access-token-1";
    setToken = vi.fn();
    logout = vi.fn().mockResolvedValue(undefined);
    vi.restoreAllMocks();
  });

  it("attaches Bearer token to requests", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    const authFetch = createAuthFetch(getToken, setToken, logout);

    await authFetch("/api/test");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const call = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const headers = call[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token-1");

    globalThis.fetch = originalFetch;
  });

  it("retries with refreshed token on 401", async () => {
    const calls: { url: unknown; auth: string | null }[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (url, init) => {
      const headers = init?.headers as Headers | undefined;
      const auth = headers?.get("Authorization") ?? null;
      calls.push({ url, auth });

      if (url === "/api/v1/oauth2/refresh") {
        return new Response(JSON.stringify({ access_token: "access-token-2" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (auth === "Bearer access-token-1") {
        return new Response("", { status: 401 });
      }
      return new Response("ok", { status: 200 });
    });

    const authFetch = createAuthFetch(getToken, setToken, logout);
    const res = await authFetch("/api/test");

    expect(res.status).toBe(200);
    expect(setToken).toHaveBeenCalledWith("access-token-2");
    expect(logout).not.toHaveBeenCalled();

    globalThis.fetch = originalFetch;
  });

  it("logs out when refresh fails", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      if (url === "/api/v1/oauth2/refresh") {
        return new Response("", { status: 401 });
      }
      return new Response("", { status: 401 });
    });

    const authFetch = createAuthFetch(getToken, setToken, logout);
    await authFetch("/api/test");

    expect(logout).toHaveBeenCalled();

    globalThis.fetch = originalFetch;
  });

  it("deduplicates concurrent refresh requests", async () => {
    let refreshCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      if (url === "/api/v1/oauth2/refresh") {
        refreshCount++;
        return new Response(JSON.stringify({ access_token: "new-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("", { status: 401 });
    });

    const authFetch = createAuthFetch(getToken, setToken, logout);
    await Promise.all([authFetch("/api/a"), authFetch("/api/b")]);

    expect(refreshCount).toBe(1);

    globalThis.fetch = originalFetch;
  });
});
