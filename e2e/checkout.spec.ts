import { test, expect } from "./fixtures";
import { LoginPage, onlyMethod } from "./pages";

const SHOW_ID = "test-show-1";

const MOCK_SEATS = [
  { id: "s1", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 1, priceCents: 5000, availability: "AVAILABLE" },
  { id: "s2", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 2, priceCents: 5000, availability: "AVAILABLE" },
];

const SEATS_URL = `**/api/v1/shows/${SHOW_ID}/seats`;
const HOLD_URL = "**/api/v1/reservations";
const SUBMIT_PAYMENT_URL = "**/api/v1/reservations/*/submit-payment";
const RESERVATION_STATUS_URL = "**/api/v1/reservations/*";

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
        return Promise.resolve({ paymentMethod: { id: "pm_test_mock_123" } });
      },
      confirmCardPayment: function() {
        return Promise.resolve({ paymentIntent: { status: "succeeded" } });
      },
    };
  };
`;

function makeReservation(expiresInMs = 300_000) {
  return {
    reservationId: "res-1",
    showId: SHOW_ID,
    seatId: "s1",
    section: "A",
    rowLabel: "A",
    seatNumber: 1,
    priceCents: 5000,
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  };
}

/** Mocks the terminal reservation status returned by GET .../reservations/{id}. */
async function mockReservationOutcome(
  page: import("@playwright/test").Page,
  status: "CONFIRMED" | "RELEASED" | "EXPIRED",
) {
  await page.route(RESERVATION_STATUS_URL, onlyMethod("GET", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        reservationId: "res-1",
        showId: SHOW_ID,
        userId: "e2e-user",
        status,
        seatIds: ["s1"],
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        ttlSeconds: 300,
      },
    }),
  ));
}

async function navigateToCheckout(page: import("@playwright/test").Page, expiresInMs = 300_000) {
  const reservation = makeReservation(expiresInMs);

  const login = new LoginPage(page);
  await login.mockPkceLogin();

  await page.addInitScript(MOCK_STRIPE_JS);

  await page.route("**/js.stripe.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "/* stripe already mocked via addInitScript */",
    });
  });

  await page.route(SEATS_URL, async (route) => {
    await route.fulfill({ json: MOCK_SEATS });
  });

  await page.route(HOLD_URL, onlyMethod("POST", (route) =>
    route.fulfill({ status: 201, json: reservation }),
  ));

  await page.goto(`/shows/${SHOW_ID}/seats`);
  await page.getByTestId("seat-A-1").click();
  await expect(page).toHaveURL(/\/checkout/, { timeout: 10_000 });
}

test.describe("Checkout Flow", () => {
  test("displays seat summary and countdown after hold", async ({ page }) => {
    await navigateToCheckout(page);

    const summary = page.getByTestId("seat-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("Section A");
    await expect(summary).toContainText("Row A");
    await expect(summary).toContainText("Seat 1");
    await expect(summary).toContainText("$50.00");

    const countdown = page.getByTestId("countdown");
    await expect(countdown).toBeVisible();
    await expect(countdown).toContainText(/\d+:\d{2}/);
  });

  test("countdown turns orange/red at 60s threshold", async ({ page }) => {
    await navigateToCheckout(page, 55_000);

    const countdown = page.getByTestId("countdown");
    await expect(countdown).toBeVisible();
    await expect(countdown).toHaveClass(/text-orange-500/);
  });

  test("shows expired state when hold expires", async ({ page }) => {
    await navigateToCheckout(page, 2_000);

    const expired = page.getByTestId("hold-expired");
    await expect(expired).toBeVisible({ timeout: 10_000 });
    await expect(expired).toContainText("Your hold has expired");

    const backButton = page.getByTestId("back-to-seats");
    await expect(backButton).toBeVisible();
  });

  test("shows payment form with pay button", async ({ page }) => {
    await navigateToCheckout(page);

    const form = page.getByTestId("payment-form");
    await expect(form).toBeVisible();

    const payButton = page.getByTestId("pay-button");
    await expect(payButton).toBeVisible();
    await expect(payButton).toContainText("Pay now");
  });

  test("payment success shows confirmation", async ({ page }) => {
    await navigateToCheckout(page);

    await page.route(SUBMIT_PAYMENT_URL, (route) => route.fulfill({ status: 202 }));
    await mockReservationOutcome(page, "CONFIRMED");

    await page.getByTestId("pay-button").click();

    const success = page.getByTestId("payment-success");
    await expect(success).toBeVisible({ timeout: 10_000 });
    await expect(success).toContainText("Booking confirmed");
  });

  test("payment failure surfaces the backend's ProblemDetail message", async ({ page }) => {
    await navigateToCheckout(page);

    // The saga runs asynchronously — a synchronous failure here means
    // submit-payment itself couldn't be started (e.g. reservation isn't HELD
    // any more), not a card decline (declines only surface via reservation
    // status). Booking's errors are RFC 7807 ProblemDetail — the "detail"
    // field is the human-readable reason and should reach the user.
    await page.route(SUBMIT_PAYMENT_URL, (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/problem+json",
        json: { detail: "Reservation is not in a payable state" },
      }),
    );

    await page.getByTestId("pay-button").click();

    const error = page.getByTestId("payment-error");
    await expect(error).toBeVisible({ timeout: 10_000 });
    await expect(error).toContainText("Reservation is not in a payable state");
  });

  test("payment failure falls back to a generic message on a non-JSON error", async ({ page }) => {
    await navigateToCheckout(page);

    await page.route(SUBMIT_PAYMENT_URL, (route) =>
      route.fulfill({ status: 500, body: "Internal error" }),
    );

    await page.getByTestId("pay-button").click();

    const error = page.getByTestId("payment-error");
    await expect(error).toBeVisible({ timeout: 10_000 });
    await expect(error).toContainText("Failed to start payment");
  });

  test("payment declined or hold expired shows hold-expired screen", async ({ page }) => {
    await navigateToCheckout(page);

    await page.route(SUBMIT_PAYMENT_URL, (route) => route.fulfill({ status: 202 }));
    await mockReservationOutcome(page, "RELEASED");

    await page.getByTestId("pay-button").click();

    const expired = page.getByTestId("hold-expired");
    await expect(expired).toBeVisible({ timeout: 10_000 });
    await expect(expired).toContainText("Your hold has expired");
  });

  test("no reservation redirects to events page", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText("No reservation found")).toBeVisible();
  });
});
