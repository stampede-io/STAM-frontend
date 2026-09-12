import { test, expect } from "../fixtures";
import { LoginPage, SeatMapPage, CheckoutPage } from "../pages";
import type { MockSeat } from "../pages";

const SHOW_ID = "test-show-expiry";

const MOCK_SEATS: MockSeat[] = [
  { id: "exp-s1", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 1, priceCents: 5000, availability: "AVAILABLE" },
];

const MOCK_STRIPE_JS = `
  window.Stripe = function() {
    var mockElement = { mount: function(){}, unmount: function(){}, destroy: function(){}, on: function(){}, update: function(){} };
    return {
      elements: function() { return { create: function() { return mockElement; }, getElement: function() { return mockElement; }, update: function(){} }; },
      createToken: function() { return Promise.resolve({ token: { id: "tok_mock" } }); },
      createPaymentMethod: function() { return Promise.resolve({ paymentMethod: { id: "pm_mock" } }); },
      confirmCardPayment: function() { return Promise.resolve({ paymentIntent: { status: "succeeded" } }); },
    };
  };
`;

test.describe("Hold Expiry", () => {
  test("hold expires after TTL and UI shows expired state", async ({ page }) => {
    const login = new LoginPage(page);
    await login.mockPkceLogin();

    const seatMap = new SeatMapPage(page, SHOW_ID);
    const checkout = new CheckoutPage(page);

    await seatMap.mockSeats(MOCK_SEATS);

    // Hold with a very short TTL (2 seconds from now)
    const expiresAt = new Date(Date.now() + 2_000).toISOString();
    await seatMap.mockHoldSuccess({
      reservationId: "res-expiry-1",
      showId: SHOW_ID,
      seatIds: ["exp-s1"],
      expiresAt,
    });

    await page.addInitScript(MOCK_STRIPE_JS);
    await seatMap.goto();
    await seatMap.clickSeat("A", 1);
    await page.waitForURL("**/checkout");

    // Wait for hold to expire
    await expect(checkout.holdExpired).toBeVisible({ timeout: 10_000 });
    await expect(checkout.holdExpired).toContainText("expired");
  });

  test("expired hold shows back-to-seats button", async ({ page }) => {
    const login = new LoginPage(page);
    await login.mockPkceLogin();

    const seatMap = new SeatMapPage(page, SHOW_ID);
    const checkout = new CheckoutPage(page);

    await seatMap.mockSeats(MOCK_SEATS);

    const expiresAt = new Date(Date.now() + 1_000).toISOString();
    await seatMap.mockHoldSuccess({
      reservationId: "res-expiry-2",
      showId: SHOW_ID,
      seatIds: ["exp-s1"],
      expiresAt,
    });

    await page.addInitScript(MOCK_STRIPE_JS);
    await seatMap.goto();
    await seatMap.clickSeat("A", 1);
    await page.waitForURL("**/checkout");

    await expect(checkout.holdExpired).toBeVisible({ timeout: 10_000 });
    await expect(checkout.backToSeats).toBeVisible();
  });
});
