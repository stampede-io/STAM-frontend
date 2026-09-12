import type { AuthFetch } from "../auth/authFetch";
import type { HeldReservation } from "./reservations";

export class PaymentTimeoutError extends Error {
  constructor() {
    super("Timed out waiting for a payment outcome");
    this.name = "PaymentTimeoutError";
  }
}

const POLL_INTERVAL_MS = 1_500;
const POLL_TIMEOUT_MS = 30_000;

/**
 * Starts the booking saga (AuthorizePayment -> payments.commands). The saga
 * runs asynchronously — a 202 here means the payment flow started, not that
 * it succeeded. The outcome is only observable via the reservation's status.
 */
export async function submitPayment(
  reservationId: string,
  authFetch: AuthFetch,
): Promise<void> {
  const res = await authFetch(
    `/api/v1/reservations/${reservationId}/submit-payment`,
    { method: "POST" },
  );

  if (res.status !== 202) {
    throw new Error(`Failed to start payment: ${res.status}`);
  }
}

/**
 * Polls the reservation until the saga has moved it out of HELD. There is no
 * synchronous decline reason at this layer — CONFIRMED is the only success
 * outcome; RELEASED/EXPIRED/REFUNDED all mean the seats were let go, whether
 * that was a card decline or the hold simply expiring.
 */
export async function pollReservationOutcome(
  reservationId: string,
  authFetch: AuthFetch,
): Promise<HeldReservation> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await authFetch(`/api/v1/reservations/${reservationId}`);
    if (!res.ok) {
      throw new Error(`Failed to check reservation status: ${res.status}`);
    }

    const reservation: HeldReservation = await res.json();
    if (reservation.status !== "HELD") return reservation;

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new PaymentTimeoutError();
}
