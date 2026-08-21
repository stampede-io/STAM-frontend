import { test, expect } from "./fixtures";

const AUTH_CONFIG = {
  authorizeUrl: "/api/v1/oauth2/authorize",
  tokenUrl: "/api/v1/oauth2/token",
  refreshUrl: "/api/v1/oauth2/refresh",
  logoutUrl: "/api/v1/oauth2/logout",
};

test.describe("PKCE Auth Flow", () => {
  test("shows login button when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("login-button")).toBeVisible();
    await expect(page.getByTestId("logout-button")).not.toBeVisible();
  });

  test("login redirects to authorize endpoint with PKCE params", async ({
    page,
  }) => {
    let authorizeUrl: URL | null = null;

    await page.route(`**${AUTH_CONFIG.authorizeUrl}*`, (route) => {
      authorizeUrl = new URL(route.request().url(), "http://localhost");
      route.fulfill({ status: 200, body: "auth page" });
    });

    await page.goto("/");
    await page.getByTestId("login-button").click();

    await page.waitForURL((url) =>
      url.pathname.includes(AUTH_CONFIG.authorizeUrl),
    );

    expect(authorizeUrl).not.toBeNull();
    const params = authorizeUrl!.searchParams;
    expect(params.get("response_type")).toBe("code");
    expect(params.get("client_id")).toBe("stampede-spa");
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("code_challenge")).toBeTruthy();
    expect(params.get("state")).toBeTruthy();
    expect(params.get("redirect_uri")).toContain("/auth/callback");
  });

  test("callback exchanges code for token and shows logout", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("pkce_code_verifier", "test-verifier-abc123");
      sessionStorage.setItem("pkce_state", "test-state-xyz");
    });

    await page.route(`**${AUTH_CONFIG.tokenUrl}`, async (route) => {
      const body = route.request().postData() ?? "";
      const params = new URLSearchParams(body);

      if (
        params.get("grant_type") === "authorization_code" &&
        params.get("code") === "auth-code-123" &&
        params.get("code_verifier") === "test-verifier-abc123"
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ access_token: "test-access-token-456" }),
        });
      } else {
        await route.fulfill({ status: 400, body: "bad request" });
      }
    });

    await page.route("**/api/v1/oauth2/refresh", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "test-access-token-456" }),
      }),
    );

    await page.goto("/auth/callback?code=auth-code-123&state=test-state-xyz");
    await page.waitForURL("/");
    await expect(page.getByTestId("logout-button")).toBeVisible();
    await expect(page.getByTestId("login-button")).not.toBeVisible();
  });

  test("callback shows error on state mismatch", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("pkce_code_verifier", "test-verifier-abc123");
      sessionStorage.setItem("pkce_state", "correct-state");
    });

    await page.goto("/auth/callback?code=auth-code-123&state=wrong-state");
    await expect(page.getByTestId("auth-error")).toContainText("State mismatch");
  });

  test("callback shows error when authorization server returns error", async ({
    page,
  }) => {
    await page.goto("/auth/callback?error=access_denied");
    await expect(page.getByTestId("auth-error")).toContainText(
      "Authorization failed: access_denied",
    );
  });

  test("callback page navigates home after successful exchange", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("pkce_code_verifier", "test-verifier");
      sessionStorage.setItem("pkce_state", "test-state");
    });

    await page.route(`**${AUTH_CONFIG.tokenUrl}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "nav-test-token" }),
      }),
    );

    await page.route("**/api/v1/oauth2/refresh", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "nav-test-token" }),
      }),
    );

    await page.goto("/auth/callback?code=test-code&state=test-state");
    await page.waitForURL("/");
    await expect(page.getByTestId("logout-button")).toBeVisible();
  });

  test("logout clears auth state and shows login button", async ({ page }) => {
    await page.route("**/api/v1/oauth2/refresh", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "token-to-revoke" }),
      }),
    );

    await page.route(`**${AUTH_CONFIG.logoutUrl}`, (route) =>
      route.fulfill({ status: 204 }),
    );

    await page.goto("/");
    await expect(page.getByTestId("logout-button")).toBeVisible();

    await page.getByTestId("logout-button").click();
    await expect(page.getByTestId("login-button")).toBeVisible();
    await expect(page.getByTestId("logout-button")).not.toBeVisible();
  });

  test("refresh on mount restores session from httpOnly cookie", async ({
    page,
  }) => {
    await page.route("**/api/v1/oauth2/refresh", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "refreshed-token" }),
      }),
    );

    await page.goto("/");
    await expect(page.getByTestId("logout-button")).toBeVisible();
  });
});
