import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useCountdown } from "../hooks/useCountdown";
import { submitPayment, pollReservationOutcome } from "../api/payments";
import { useAuth } from "../auth/useAuth";
import type { Reservation } from "../types/reservation";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
    "pk_test_TYooMQauvdEDq54NiTphI7jx",
);

type PaymentStatus = "idle" | "loading" | "success" | "failure" | "expired";

function CheckoutForm({ reservation }: { reservation: Reservation }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { secondsLeft, expired, formatted } = useCountdown(
    reservation.expiresAt,
  );
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const WARNING_THRESHOLD = 60;
  const isWarning = secondsLeft <= WARNING_THRESHOLD && secondsLeft > 0;

  const countdownColor = expired
    ? "text-red-600"
    : isWarning
      ? "text-orange-500"
      : "text-gray-700";

  if (expired && status === "idle") {
    setStatus("expired");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!stripe || !elements || expired) return;

    setStatus("loading");
    setErrorMessage(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    // Validates the card client-side before we start the saga. The resulting
    // paymentMethod id has nowhere to go yet — booking's submit-payment takes
    // no request body and never threads a paymentMethodId through to payment's
    // AuthorizePayment command (see STAM-booking), so every real authorize
    // currently fails with "missing_payment_method" until that's fixed.
    const { error } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
    });

    if (error) {
      setStatus("failure");
      setErrorMessage(error.message ?? "Card validation failed");
      return;
    }

    try {
      await submitPayment(reservation.reservationId, authFetch);
      const outcome = await pollReservationOutcome(
        reservation.reservationId,
        authFetch,
      );
      setStatus(outcome.status === "CONFIRMED" ? "success" : "expired");
    } catch (err) {
      setStatus("failure");
      setErrorMessage(
        err instanceof Error ? err.message : "Payment failed — please try again",
      );
    }
  }

  if (status === "success") {
    return (
      <div className="max-w-md mx-auto text-center py-16" data-testid="payment-success">
        <div className="text-green-600 text-5xl mb-4">&#10003;</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Booking confirmed
        </h2>
        <p className="text-gray-600 mb-6">
          Confirmation email sent — check your inbox.
        </p>
        <button
          onClick={() => navigate("/")}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
        >
          Back to home
        </button>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="max-w-md mx-auto text-center py-16" data-testid="hold-expired">
        <div className="text-red-600 text-5xl mb-4">&#9201;</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Your hold has expired
        </h2>
        <p className="text-gray-600 mb-6">
          The seats have been released. Please go back and try again.
        </p>
        <button
          onClick={() =>
            navigate(`/shows/${reservation.showId}/seats`)
          }
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          data-testid="back-to-seats"
        >
          Return to seat map
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div
        className="bg-white rounded-lg shadow p-6 mb-6"
        data-testid="seat-summary"
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Seat summary
        </h2>
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            Section {reservation.section}, Row {reservation.rowLabel}, Seat{" "}
            {reservation.seatNumber}
          </span>
          <span className="font-medium text-gray-900">
            ${(reservation.priceCents / 100).toFixed(2)}
          </span>
        </div>
      </div>

      <div
        className={`text-center text-3xl font-mono font-bold mb-6 ${countdownColor}`}
        data-testid="countdown"
        aria-live="polite"
      >
        {formatted}
      </div>

      <form onSubmit={handleSubmit} data-testid="payment-form">
        <div className="bg-white rounded-lg shadow p-6 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Card details
          </label>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#1f2937",
                  "::placeholder": { color: "#9ca3af" },
                },
              },
            }}
          />
        </div>

        {status === "failure" && errorMessage && (
          <div
            role="alert"
            className="text-red-600 text-sm mb-4"
            data-testid="payment-error"
          >
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={!stripe || status === "loading"}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          data-testid="pay-button"
        >
          {status === "loading" ? "Processing…" : "Pay now"}
        </button>
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const reservation = location.state?.reservation as Reservation | undefined;

  if (!reservation) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          No reservation found
        </h2>
        <p className="text-gray-600 mb-6">
          Please select a seat first.
        </p>
        <button
          onClick={() => navigate("/")}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
        >
          Go to events
        </button>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm reservation={reservation} />
    </Elements>
  );
}
