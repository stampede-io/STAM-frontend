import { test, expect } from "@playwright/test";

/**
 * STAM-440 AC4 — the test that would have caught the SPA↔gateway join being
 * broken. It imports from "@playwright/test" directly, NOT from ../fixtures,
 * because fixtures.ts installs a global page.route() mock for the refresh
 * endpoint. Nothing here is mocked: the SPA talks to the real gateway, which
 * talks to the real identity / catalog / booking services in compose-dev.
 *
 * Requires the full stack up (STAM-platform/compose-dev, frontend included) and
 * RUN_REAL_E2E=1. BASE_URL defaults to the compose frontend on :5173.
 */

const CATALOG_URL = process.env.CATALOG_URL ?? "http://localhost:8081";
const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8085";

test.describe("real SPA → gateway journey (no mocks)", () => {
  test("register → login → seat map → hold a seat", async ({ page, request }) => {
    // 1. Seed a venue/show/seats via catalog's dev-profile helper (direct hit).
    //    Reset first: the seed data is a fixed venue name, reused (not
    //    recreated) on every run, so a seat held by an earlier run would
    //    otherwise stay HELD and this test would click a seat that's already
    //    taken.
    await request.delete(`${CATALOG_URL}/api/test-seed`);
    const seed = await request.post(`${CATALOG_URL}/api/test-seed`);
    expect(seed.ok(), "catalog seed endpoint reachable").toBeTruthy();
    const { showId } = await seed.json();
    expect(showId, "seed returned a showId").toBeTruthy();

    // 2. Register a fresh user through the gateway (public route).
    const email = `e2e-${Date.now()}@stampede.test`;
    const password = "e2e-Password-123";
    const register = await request.post(`${GATEWAY_URL}/api/v1/users/register`, {
      data: { email, password },
    });
    expect(
      [200, 201, 409].includes(register.status()),
      `register status ${register.status()}`,
    ).toBeTruthy();

    // 3. Log in through the real Authorization Server. The SPA redirects to
    //    /oauth2/authorize (gateway → identity), identity shows its login form,
    //    and on success the code comes back to /auth/callback where the SPA
    //    exchanges it via the gateway BFF — refresh token lands in an httpOnly
    //    cookie, the SPA gets only the access token.
    await page.goto("/");
    await page.getByTestId("login-button").click();

    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await page.fill('input[name="username"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForURL(
      (url) => url.pathname === "/" || url.pathname === "",
      { timeout: 20_000 },
    );
    await expect(page.getByTestId("logout-button")).toBeVisible();

    // 4. Seat map renders from the real catalog availability projection.
    await page.goto(`/shows/${showId}/seats`);
    const seat = page.getByTestId("seat-A-1");
    await expect(seat).toBeVisible({ timeout: 15_000 });

    // 5. Hold it — real POST /api/v1/reservations through the gateway to booking,
    //    with the bearer token the SPA now attaches and a client idempotency key.
    await seat.click();
    await expect(page).toHaveURL(/\/checkout/, { timeout: 20_000 });
    await expect(page.getByTestId("seat-summary")).toContainText("Row A");
    await expect(page.getByTestId("countdown")).toBeVisible();
  });
});
