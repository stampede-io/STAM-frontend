import { test, expect } from "./fixtures";
import { LoginPage } from "./pages";

const SHOW_ID = "test-show-1";

const MOCK_SEATS = [
  { id: "s1", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 1, priceCents: 5000, availability: "AVAILABLE" },
  { id: "s2", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 2, priceCents: 5000, availability: "AVAILABLE" },
  { id: "s3", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 3, priceCents: 5000, availability: "HELD" },
  { id: "s4", showId: SHOW_ID, section: "B", rowLabel: "B", seatNumber: 1, priceCents: 7500, availability: "CONFIRMED" },
];

const SEATS_URL = `**/api/v1/shows/${SHOW_ID}/seats`;
const HOLD_URL = "**/api/v1/reservations";

test.describe("Seat Map", () => {
  test("renders seats with correct availability colors", async ({ page }) => {
    await page.route(SEATS_URL, (route) => route.fulfill({ json: MOCK_SEATS }));

    await page.goto(`/shows/${SHOW_ID}/seats`);

    const availableSeat = page.getByTestId("seat-A-1");
    await expect(availableSeat).toBeVisible();
    await expect(availableSeat).toHaveAttribute("data-availability", "AVAILABLE");
    await expect(availableSeat).toHaveClass(/bg-green-500/);

    const heldSeat = page.getByTestId("seat-A-3");
    await expect(heldSeat).toHaveAttribute("data-availability", "HELD");
    await expect(heldSeat).toHaveClass(/bg-yellow-500/);

    const confirmedSeat = page.getByTestId("seat-B-1");
    await expect(confirmedSeat).toHaveAttribute("data-availability", "CONFIRMED");
    await expect(confirmedSeat).toHaveClass(/bg-gray-400/);
  });

  test("hold seat navigates to checkout page", async ({ page }) => {
    const login = new LoginPage(page);
    await login.mockPkceLogin();

    const reservation = {
      reservationId: "res-1",
      showId: SHOW_ID,
      userId: "e2e-user",
      status: "HELD",
      seatIds: ["s1"],
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
      ttlSeconds: 300,
    };

    await page.route(HOLD_URL, (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({ status: 201, json: reservation });
    });

    await page.route(SEATS_URL, (route) => route.fulfill({ json: MOCK_SEATS }));

    await page.goto(`/shows/${SHOW_ID}/seats`);

    const seat = page.getByTestId("seat-A-1");
    await expect(seat).toHaveClass(/bg-green-500/);

    await seat.click();

    await expect(page).toHaveURL(/\/checkout/, { timeout: 10_000 });
  });

  test("409 response shows just-taken toast and refreshes map", async ({ page }) => {
    const login = new LoginPage(page);
    await login.mockPkceLogin();

    let holdAttempted = false;

    await page.route(HOLD_URL, (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      holdAttempted = true;
      return route.fulfill({ status: 409, json: { error: "Seat already held" } });
    });

    await page.route(SEATS_URL, (route) => {
      if (holdAttempted) {
        const updated = MOCK_SEATS.map((s) =>
          s.id === "s1" ? { ...s, availability: "HELD" } : s,
        );
        return route.fulfill({ json: updated });
      }
      return route.fulfill({ json: MOCK_SEATS });
    });

    await page.goto(`/shows/${SHOW_ID}/seats`);
    await page.getByTestId("seat-A-1").click();

    const toast = page.getByTestId("just-taken-toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("just taken");

    await expect(page.getByTestId("seat-A-1")).toHaveAttribute(
      "data-availability",
      "HELD",
      { timeout: 10_000 },
    );
  });

  test("clicking held seat shows unavailable message", async ({ page }) => {
    await page.route(SEATS_URL, (route) => route.fulfill({ json: MOCK_SEATS }));

    await page.goto(`/shows/${SHOW_ID}/seats`);

    await page.getByTestId("seat-A-3").click();

    await expect(page.getByRole("alert")).toContainText("Seat unavailable");
  });
});
