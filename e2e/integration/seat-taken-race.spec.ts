import { test, expect } from "../fixtures";
import { LoginPage, SeatMapPage, fakeJwt } from "../pages";
import type { MockSeat } from "../pages";

const SHOW_ID = "test-show-race";

const MOCK_SEATS: MockSeat[] = [
  { id: "race-s1", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 1, priceCents: 5000, availability: "AVAILABLE" },
  { id: "race-s2", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 2, priceCents: 5000, availability: "AVAILABLE" },
];

test.describe("Seat-Taken Race", () => {
  test("two contexts competing for the same seat — one wins, one sees conflict", async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    const login1 = new LoginPage(page1);
    const login2 = new LoginPage(page2);
    await login1.mockPkceLogin(fakeJwt({ user_id: "race-winner" }));
    await login2.mockPkceLogin(fakeJwt({ user_id: "race-loser" }));

    const seatMap1 = new SeatMapPage(page1, SHOW_ID);
    const seatMap2 = new SeatMapPage(page2, SHOW_ID);

    // Both see the same available seats
    await seatMap1.mockSeats(MOCK_SEATS);
    await seatMap2.mockSeats(MOCK_SEATS);

    // Page 1 gets the hold
    const expiresAt = new Date(Date.now() + 300_000).toISOString();
    await seatMap1.mockHoldSuccess({
      reservationId: "res-race-winner",
      showId: SHOW_ID,
      seatIds: ["race-s1"],
      expiresAt,
    });

    // Page 2 gets 409 conflict
    await seatMap2.mockHoldConflict();

    // Both navigate to seat map
    await seatMap1.goto();
    await seatMap2.goto();

    await expect(seatMap1.seat("A", 1)).toBeVisible();
    await expect(seatMap2.seat("A", 1)).toBeVisible();

    // Inject Stripe mock for the winner (needed for checkout page)
    await page1.addInitScript(`
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

    // Both try to hold seat A-1
    await seatMap1.clickSeat("A", 1);
    await seatMap2.clickSeat("A", 1);

    // Winner goes to checkout
    await page1.waitForURL("**/checkout");

    // Loser sees "just taken" toast and seats refresh
    const seatsAfterConflict: MockSeat[] = [
      { id: "race-s1", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 1, priceCents: 5000, availability: "HELD" },
      { id: "race-s2", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 2, priceCents: 5000, availability: "AVAILABLE" },
    ];
    await page2.route(`**/api/v1/shows/${SHOW_ID}/seats`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(seatsAfterConflict),
      }),
    );

    await expect(seatMap2.toastMessage).toBeVisible();

    await ctx1.close();
    await ctx2.close();
  });
});
