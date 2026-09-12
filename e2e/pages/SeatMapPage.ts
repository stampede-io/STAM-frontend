import type { Page } from "@playwright/test";

export interface MockSeat {
  id: string;
  showId: string;
  section: string;
  rowLabel: string;
  seatNumber: number;
  priceCents: number;
  availability: "AVAILABLE" | "HELD" | "CONFIRMED" | "EXPIRED";
}

/** Shape of booking's real ReservationResponse (POST /api/v1/reservations). */
export interface MockReservation {
  reservationId: string;
  showId: string;
  userId?: string;
  status?: string;
  seatIds?: string[];
  expiresAt: string;
  ttlSeconds?: number;
}

export class SeatMapPage {
  constructor(
    private page: Page,
    private showId: string,
  ) {}

  get toastMessage() {
    return this.page.getByTestId("just-taken-toast");
  }

  seat(row: string, num: number) {
    return this.page.getByTestId(`seat-${row}-${num}`);
  }

  async mockSeats(seats: MockSeat[]) {
    await this.page.route(
      `**/api/v1/shows/${this.showId}/seats`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(seats),
        }),
    );
  }

  async mockHoldSuccess(reservation: MockReservation) {
    await this.page.route("**/api/v1/reservations", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          userId: "e2e-user",
          status: "HELD",
          seatIds: [],
          ttlSeconds: 300,
          ...reservation,
        }),
      });
    });
  }

  async mockHoldConflict() {
    await this.page.route("**/api/v1/reservations", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({ status: 409, body: "seat taken" });
    });
  }

  async mockHoldRateLimit(retryAfter = 10) {
    await this.page.route("**/api/v1/reservations", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
        body: "rate limited",
      });
    });
  }

  async goto() {
    await this.page.goto(`/shows/${this.showId}/seats`);
  }

  async clickSeat(row: string, num: number) {
    await this.seat(row, num).click();
  }
}
