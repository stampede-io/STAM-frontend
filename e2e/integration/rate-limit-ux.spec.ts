import { test, expect } from "../fixtures";
import { LoginPage, SeatMapPage, onlyMethod } from "../pages";
import type { MockSeat } from "../pages";

const SHOW_ID = "test-show-ratelimit";

const MOCK_SEATS: MockSeat[] = [
  { id: "rl-s1", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 1, priceCents: 5000, availability: "AVAILABLE" },
  { id: "rl-s2", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 2, priceCents: 5000, availability: "AVAILABLE" },
  { id: "rl-s3", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 3, priceCents: 5000, availability: "AVAILABLE" },
];

test.describe("Rate-Limit UX", () => {
  test("429 response shows friendly slow-down message", async ({ page }) => {
    const login = new LoginPage(page);
    await login.mockPkceLogin();

    const seatMap = new SeatMapPage(page, SHOW_ID);

    await seatMap.mockSeats(MOCK_SEATS);
    await seatMap.mockHoldRateLimit(10);

    await seatMap.goto();
    await expect(seatMap.seat("A", 1)).toBeVisible();

    // Try to hold a seat — should get rate limited
    await seatMap.clickSeat("A", 1);

    // Verify the UI shows a rate-limit message
    await expect(
      page.getByText(/slow down|try again|rate limit/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("multiple rapid hold attempts trigger rate limit", async ({ page }) => {
    const login = new LoginPage(page);
    await login.mockPkceLogin();

    const seatMap = new SeatMapPage(page, SHOW_ID);
    let holdCount = 0;

    await seatMap.mockSeats(MOCK_SEATS);

    // First hold succeeds, subsequent ones get rate-limited
    await page.route("**/api/v1/reservations", onlyMethod("POST", (route) => {
      holdCount++;
      if (holdCount === 1) {
        const expiresAt = new Date(Date.now() + 300_000).toISOString();
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            reservationId: "res-rl-1",
            showId: SHOW_ID,
            userId: "e2e-user",
            status: "HELD",
            seatIds: ["rl-s1"],
            expiresAt,
            ttlSeconds: 300,
          }),
        });
      }
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": "15" },
        body: "Too many requests",
      });
    }));

    // Inject Stripe mock for potential checkout navigation
    await page.addInitScript(`
      window.Stripe = function() {
        var mockElement = { mount: function(){}, unmount: function(){}, destroy: function(){}, on: function(){}, update: function(){} };
        return {
          elements: function() { return { create: function() { return mockElement; }, getElement: function() { return mockElement; }, update: function(){} }; },
          createToken: function() { return Promise.resolve({ token: { id: "tok_mock" } }); },
          createPaymentMethod: function() { return Promise.resolve({ paymentMethod: { id: "pm_mock" } }); },
          confirmCardPayment: function() { return Promise.resolve({ paymentIntent: { status: "succeeded" } }); },
        };
      };
    `);

    await seatMap.goto();

    // First click goes through (navigates to checkout or holds)
    await seatMap.clickSeat("A", 1);
    // Navigate back to seat map for second attempt
    await page.goto(`/shows/${SHOW_ID}/seats`);
    await seatMap.mockSeats(MOCK_SEATS);

    // Second attempt should show rate-limit message
    await seatMap.clickSeat("A", 2);
    await expect(
      page.getByText(/slow down|try again|rate limit/i),
    ).toBeVisible({ timeout: 5_000 });
  });
});
