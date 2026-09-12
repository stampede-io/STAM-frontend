import type { AuthFetch } from "../auth/authFetch";
import type { HeldReservation } from "./reservations";

export class PaymentTimeoutError extends Error {
  constructor() {
    super("Timed out waiting for a payment outcome");
    this.name = "PaymentTimeoutError";
  }
}

const POLL_INTERVAL_MS = 1_500;
// Generous relative to a normal AuthorizePayment round trip (sub-second) —
// covers a Kafka rebalance or GC pause without falsely timing out a checkout
// that's about to confirm.
const POLL_TIMEOUT_MS = 60_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * Starts the booking saga (AuthorizePayment -> payments.commands). The saga
 * runs asynchronously — a 202 here means the payment flow started, not that
 * it succeeded. The outcome is only observable via the reservation's status.
 * No Idempotency-Key needed: submit-payment is already idempotent server-side
 * (it looks up the saga by reservationId), so a client retry is safe as-is.
 */
export async function submitPayment(
  reservationId: string,
  authFetch: AuthFetch,
  signal?: AbortSignal,
): Promise<void> {
  const res = await authFetch(
    `/api/v1/reservations/${reservationId}/submit-payment`,
    { method: "POST", signal },
  );

  if (res.status !== 202) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `Failed to start payment: ${res.status}`);
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
  signal?: AbortSignal,
): Promise<HeldReservation> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await authFetch(`/api/v1/reservations/${reservationId}`, {
      signal,
    });
    if (!res.ok) {
      throw new Error(`Failed to check reservation status: ${res.status}`);
    }

    const reservation: HeldReservation = await res.json();
    if (reservation.status !== "HELD") return reservation;

    await sleep(POLL_INTERVAL_MS, signal);
  }

  throw new PaymentTimeoutError();
}
