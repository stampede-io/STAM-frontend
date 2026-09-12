import type { Page } from "@playwright/test";
import { onlyMethod } from "./routeGuard";

export class CheckoutPage {
  constructor(private page: Page) {}

  get seatSummary() {
    return this.page.getByTestId("seat-summary");
  }

  get countdown() {
    return this.page.getByTestId("countdown");
  }

  get paymentForm() {
    return this.page.getByTestId("payment-form");
  }

  get payButton() {
    return this.page.getByTestId("pay-button");
  }

  get paymentSuccess() {
    return this.page.getByTestId("payment-success");
  }

  get paymentError() {
    return this.page.getByTestId("payment-error");
  }

  get holdExpired() {
    return this.page.getByTestId("hold-expired");
  }

  get backToSeats() {
    return this.page.getByTestId("back-to-seats");
  }

  private async mockOutcome(status: "CONFIRMED" | "RELEASED" | "EXPIRED") {
    await this.page.route("**/api/v1/reservations/*/submit-payment", (route) =>
      route.fulfill({ status: 202 }),
    );
    await this.page.route(
      "**/api/v1/reservations/*",
      onlyMethod("GET", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            reservationId: "res-1",
            showId: "unused",
            userId: "unused",
            status,
            seatIds: [],
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
            ttlSeconds: 300,
          }),
        }),
      ),
    );
  }

  /** Saga confirms the reservation — payment succeeded. */
  async mockPaymentSuccess() {
    await this.mockOutcome("CONFIRMED");
  }

  /** Saga compensates and releases the seats — payment declined. */
  async mockPaymentFailure() {
    await this.mockOutcome("RELEASED");
  }

  /** Hold expired before/during payment. */
  async mockPaymentExpired() {
    await this.mockOutcome("EXPIRED");
  }
}
