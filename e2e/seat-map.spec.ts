import { test, expect } from "@playwright/test";

const SHOW_ID = "test-show-1";

const MOCK_SEATS = [
  { id: "s1", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 1, priceCents: 5000, availability: "AVAILABLE" },
  { id: "s2", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 2, priceCents: 5000, availability: "AVAILABLE" },
  { id: "s3", showId: SHOW_ID, section: "A", rowLabel: "A", seatNumber: 3, priceCents: 5000, availability: "HELD" },
  { id: "s4", showId: SHOW_ID, section: "B", rowLabel: "B", seatNumber: 1, priceCents: 7500, availability: "CONFIRMED" },
];

const SEATS_URL = `**/api/v1/shows/${SHOW_ID}/seats`;
const HOLD_URL = `**/api/v1/shows/${SHOW_ID}/seats/*/hold`;

test.describe("Seat Map", () => {
  test("renders seats with correct availability colors", async ({ page }) => {
    await page.route(SEATS_URL, async (route) => {
      if (route.request().url().includes("/hold")) return route.fallback();
      await route.fulfill({ json: MOCK_SEATS });
    });

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
    const reservation = {
      reservationId: "res-1",
      showId: SHOW_ID,
      seatId: "s1",
      section: "A",
      rowLabel: "A",
      seatNumber: 1,
      priceCents: 5000,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };

    await page.route(HOLD_URL, async (route) => {
      await route.fulfill({ status: 200, json: reservation });
    });

    await page.route(SEATS_URL, async (route) => {
      if (route.request().url().includes("/hold")) return route.fallback();
      await route.fulfill({ json: MOCK_SEATS });
    });

    await page.goto(`/shows/${SHOW_ID}/seats`);

    const seat = page.getByTestId("seat-A-1");
    await expect(seat).toHaveClass(/bg-green-500/);

    await seat.click();

    await expect(page).toHaveURL(/\/checkout/, { timeout: 10_000 });
  });

  test("409 response shows just-taken toast and refreshes map", async ({ page }) => {
    let holdAttempted = false;

    await page.route(HOLD_URL, async (route) => {
      holdAttempted = true;
      await route.fulfill({ status: 409, json: { error: "Seat already held" } });
    });

    await page.route(SEATS_URL, async (route) => {
      if (route.request().url().includes("/hold")) return route.fallback();
      if (holdAttempted) {
        const updated = MOCK_SEATS.map((s) =>
          s.id === "s1" ? { ...s, availability: "HELD" } : s,
        );
        await route.fulfill({ json: updated });
      } else {
        await route.fulfill({ json: MOCK_SEATS });
      }
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
    await page.route(SEATS_URL, async (route) => {
      if (route.request().url().includes("/hold")) return route.fallback();
      await route.fulfill({ json: MOCK_SEATS });
    });

    await page.goto(`/shows/${SHOW_ID}/seats`);

    await page.getByTestId("seat-A-3").click();

    await expect(page.getByRole("alert")).toContainText("Seat unavailable");
  });
});
