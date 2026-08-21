import type { Page } from "@playwright/test";

export interface MockSeat {
  id: string;
  showId: string;
  section: string;
  rowLabel: string;
  seatNumber: number;
  priceCents: number;
  availability: "AVAILABLE" | "HELD" | "SOLD";
}

export interface MockReservation {
  reservationId: string;
  showId: string;
  seatId: string;
  section: string;
  rowLabel: string;
  seatNumber: number;
  priceCents: number;
  expiresAt: string;
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
    await this.page.route(
      `**/api/v1/shows/${this.showId}/seats/*/hold`,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(reservation),
        }),
    );
  }

  async mockHoldConflict() {
    await this.page.route(
      `**/api/v1/shows/${this.showId}/seats/*/hold`,
      (route) => route.fulfill({ status: 409, body: "seat taken" }),
    );
  }

  async mockHoldRateLimit(retryAfter = 10) {
    await this.page.route(
      `**/api/v1/shows/${this.showId}/seats/*/hold`,
      (route) =>
        route.fulfill({
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
          body: "rate limited",
        }),
    );
  }

  async goto() {
    await this.page.goto(`/shows/${this.showId}/seats`);
  }

  async clickSeat(row: string, num: number) {
    await this.seat(row, num).click();
  }
}
