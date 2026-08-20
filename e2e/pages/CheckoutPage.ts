import type { Page } from "@playwright/test";

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

  async mockPaymentSuccess() {
    await this.page.route("**/api/v1/payments", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "SUCCESS", bookingId: "booking-1" }),
      }),
    );
  }

  async mockPaymentFailure() {
    await this.page.route("**/api/v1/payments", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "FAILED" }),
      }),
    );
  }

  async mockPaymentExpired() {
    await this.page.route("**/api/v1/payments", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "EXPIRED" }),
      }),
    );
  }
}
