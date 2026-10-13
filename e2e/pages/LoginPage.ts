import type { Page } from "@playwright/test";

/** A signature-less JWT whose payload carries the claims the SPA reads. */
export function fakeJwt(claims: Record<string, unknown> = {}): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const payload = {
    sub: "e2e-user",
    user_id: "00000000-0000-0000-0000-0000000000e2",
    roles: ["USER"],
    ...claims,
  };
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.sig`;
}

export class LoginPage {
  constructor(private page: Page) {}

  get loginButton() {
    return this.page.getByTestId("login-button");
  }

  get logoutButton() {
    return this.page.getByTestId("logout-button");
  }

  get authError() {
    return this.page.getByTestId("auth-error");
  }

  get authLoading() {
    return this.page.getByTestId("auth-loading");
  }

  async mockPkceLogin(accessToken: string = fakeJwt()) {
    await this.page.addInitScript(() => {
      sessionStorage.setItem("pkce_code_verifier", "e2e-verifier");
      sessionStorage.setItem("pkce_state", "e2e-state");
    });

    await this.page.route("**/api/v1/oauth2/token", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: accessToken }),
      }),
    );

    await this.page.route("**/api/v1/oauth2/refresh", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: accessToken }),
      }),
    );

    await this.page.goto("/auth/callback?code=e2e-code&state=e2e-state");
    await this.page.waitForURL("/");
  }

  async mockLogout() {
    await this.page.route("**/api/v1/oauth2/logout", (route) =>
      route.fulfill({ status: 204 }),
    );
    await this.logoutButton.click();
  }
}
