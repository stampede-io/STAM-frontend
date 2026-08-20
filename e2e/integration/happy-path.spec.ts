import { test, expect } from "../fixtures";
import { LoginPage, SeatMapPage, CheckoutPage } from "../pages";
import type { MockSeat } from "../pages";

const SHOW_ID = "test-show-hp";

const MOCK_SEATS: MockSeat[] = [
  { id: "hp-s1", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 1, priceCents: 7500, availability: "AVAILABLE" },
  { id: "hp-s2", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 2, priceCents: 7500, availability: "AVAILABLE" },
  { id: "hp-s3", showId: SHOW_ID, section: "B", rowLabel: "B", seatNumber: 1, priceCents: 5000, availability: "SOLD" },
];

const MOCK_STRIPE_JS = `
  window.Stripe = function() {
    var mockElement = {
      mount: function() {},
      unmount: function() {},
      destroy: function() {},
      on: function() {},
      update: function() {},
    };
    return {
      elements: function() {
        return {
          create: function() { return mockElement; },
          getElement: function() { return mockElement; },
          update: function() {},
        };
      },
      createToken: function() { return Promise.resolve({ token: { id: "tok_mock" } }); },
      createPaymentMethod: function() {
        return Promise.resolve({ paymentMethod: { id: "pm_hp_mock" } });
      },
      confirmCardPayment: function() {
        return Promise.resolve({ paymentIntent: { status: "succeeded" } });
      },
    };
  };
`;

test.describe("Happy Path: login → browse → hold → pay → confirm", () => {
  test("full checkout journey", async ({ page }) => {
    const login = new LoginPage(page);
    const seatMap = new SeatMapPage(page, SHOW_ID);
    const checkout = new CheckoutPage(page);

    // Step 1: Login via PKCE
    await login.mockPkceLogin("hp-access-token");
    await expect(login.logoutButton).toBeVisible();

    // Step 2: Browse to show and see seats
    await seatMap.mockSeats(MOCK_SEATS);
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    await seatMap.mockHoldSuccess({
      reservationId: "res-hp-1",
      showId: SHOW_ID,
      seatId: "hp-s1",
      section: "A",
      rowLabel: "A",
      seatNumber: 1,
      priceCents: 7500,
      expiresAt,
    });

    await page.addInitScript(MOCK_STRIPE_JS);
    await seatMap.goto();
    await expect(seatMap.seat("A", 1)).toBeVisible();
    await expect(seatMap.seat("A", 2)).toBeVisible();

    // Step 3: Hold a seat
    await seatMap.clickSeat("A", 1);
    await page.waitForURL("**/checkout");

    // Step 4: Verify checkout shows seat summary and countdown
    await expect(checkout.seatSummary).toContainText("A");
    await expect(checkout.countdown).toBeVisible();

    // Step 5: Submit payment
    await checkout.mockPaymentSuccess();
    await checkout.payButton.click();

    // Step 6: Verify booking confirmed
    await expect(checkout.paymentSuccess).toContainText("Booking confirmed");
  });

  test("authenticated user sees logout button on seat map", async ({ page }) => {
    const login = new LoginPage(page);
    const seatMap = new SeatMapPage(page, SHOW_ID);

    await login.mockPkceLogin();
    await seatMap.mockSeats(MOCK_SEATS);
    await seatMap.goto();

    await expect(login.logoutButton).toBeVisible();
    await expect(seatMap.seat("A", 1)).toBeVisible();
  });
});
