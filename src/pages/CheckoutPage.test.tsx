import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import CheckoutPage from "./CheckoutPage";
import type { Reservation } from "../types/reservation";

const authFetch = vi.fn();

vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ authFetch }) }));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: () => Promise.resolve(null) }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: ReactNode }) => children,
  CardElement: () => null,
  useElements: () => ({ getElement: () => ({}) }),
  useStripe: () => ({
    createPaymentMethod: () =>
      Promise.resolve({ paymentMethod: { id: "pm_card_visa" } }),
  }),
}));

const reservation: Reservation = {
  reservationId: "res-1",
  showId: "show-1",
  seatId: "s1",
  section: "A",
  rowLabel: "A",
  seatNumber: 1,
  priceCents: 5000,
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderCheckout() {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/checkout", state: { reservation } }]}>
      <CheckoutPage />
    </MemoryRouter>,
  );
}

describe("CheckoutPage payment submission (STAM-442)", () => {
  beforeEach(() => authFetch.mockReset());

  it("PATCHes the paymentMethodId before submit-payment, without an amount", async () => {
    authFetch.mockImplementation(async (url: string = "") => {
      if (url.endsWith("/payment-method")) return json({ ...reservation, status: "HELD" });
      if (url.endsWith("/submit-payment")) return new Response(null, { status: 202 });
      return json({ ...reservation, status: "CONFIRMED" });
    });

    renderCheckout();
    await userEvent.click(screen.getByTestId("pay-button"));
    await screen.findByTestId("payment-success");

    const calls = authFetch.mock.calls.map(([url, init]) => [url, init?.method]);
    expect(calls.slice(0, 2)).toEqual([
      ["/api/v1/reservations/res-1/payment-method", "PATCH"],
      ["/api/v1/reservations/res-1/submit-payment", "POST"],
    ]);
    const patchBody = JSON.parse(authFetch.mock.calls[0]![1].body);
    expect(patchBody).toEqual({ paymentMethodId: "pm_card_visa" });
  });

  it("surfaces a 409 from payment-method and never starts the saga", async () => {
    authFetch.mockResolvedValue(
      json({ detail: "Reservation res-1 is no longer HELD" }, 409),
    );

    renderCheckout();
    await userEvent.click(screen.getByTestId("pay-button"));

    expect(await screen.findByTestId("payment-error")).toHaveTextContent(
      "Reservation res-1 is no longer HELD",
    );
    expect(authFetch).toHaveBeenCalledTimes(1);
  });
});
