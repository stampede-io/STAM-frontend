import { decodeJwtClaims } from "../auth/jwt";
import type { AuthFetch } from "../auth/authFetch";

/** Mirrors booking's ReservationStatus enum. */
export type ReservationState =
  | "HELD"
  | "CONFIRMED"
  | "RELEASED"
  | "EXPIRED"
  | "REFUNDED";

/** Shape returned by booking's POST /api/v1/reservations (ReservationResponse). */
export interface HeldReservation {
  reservationId: string;
  showId: string;
  userId: string;
  status: ReservationState;
  seatIds: string[];
  expiresAt: string;
  ttlSeconds: number;
}

export class SeatUnavailableError extends Error {
  constructor() {
    super("seat unavailable");
    this.name = "SeatUnavailableError";
  }
}

export class RateLimitedError extends Error {
  constructor(readonly retryAfter: string) {
    super("rate limited");
    this.name = "RateLimitedError";
  }
}

/**
 * Hold a single seat. Calls the real booking endpoint through the gateway:
 * a client-generated Idempotency-Key makes retries safe, and the access token
 * is forwarded as a bearer for the gateway to validate.
 */
export async function holdSeat(
  showId: string,
  seatId: string,
  accessToken: string,
  authFetch: AuthFetch,
): Promise<HeldReservation> {
  const userId = decodeJwtClaims(accessToken).user_id;
  if (typeof userId !== "string") {
    throw new Error("Access token is missing the user_id claim");
  }

  const res = await authFetch("/api/v1/reservations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({ showId, userId, seatIds: [seatId] }),
  });

  if (res.status === 409) throw new SeatUnavailableError();
  if (res.status === 429) {
    throw new RateLimitedError(res.headers.get("Retry-After") ?? "a few");
  }
  if (!res.ok) throw new Error(`Hold failed: ${res.status}`);

  return res.json();
}
