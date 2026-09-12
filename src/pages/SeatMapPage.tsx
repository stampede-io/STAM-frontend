import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import SeatMap from "../components/SeatMap";
import { useSeatAvailability } from "../hooks/useSeatAvailability";
import { useAuth } from "../auth/useAuth";
import {
  holdSeat,
  RateLimitedError,
  SeatUnavailableError,
} from "../api/reservations";
import type { Seat } from "../types/seat";
import type { Reservation } from "../types/reservation";

export default function SeatMapPage() {
  const { showId } = useParams<{ showId: string }>();
  const navigate = useNavigate();
  const { getAccessToken } = useAuth();
  const { seats, loading, error, refresh } = useSeatAvailability(showId);
  const [justTakenMsg, setJustTakenMsg] = useState<string | null>(null);

  function flash(message: string, ms = 3000) {
    setJustTakenMsg(message);
    setTimeout(() => setJustTakenMsg(null), ms);
  }

  async function handleSeatClick(seat: Seat) {
    const token = getAccessToken();
    if (!token) {
      flash("Please log in to reserve a seat");
      return;
    }

    try {
      const held = await holdSeat(showId!, seat.id, token);
      const reservation: Reservation = {
        reservationId: held.reservationId,
        showId: held.showId,
        seatId: seat.id,
        section: seat.section,
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber,
        priceCents: seat.priceCents,
        expiresAt: held.expiresAt,
      };
      navigate("/checkout", { state: { reservation } });
    } catch (err) {
      if (err instanceof SeatUnavailableError) {
        flash("That seat was just taken — please select another");
        await refresh();
        return;
      }
      if (err instanceof RateLimitedError) {
        flash(`Slow down — please try again in ${err.retryAfter} seconds`, 5000);
        return;
      }
      flash(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-gray-500">Loading seat map...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <h1 className="text-2xl font-bold text-center mb-8">Select Your Seats</h1>

      <SeatMap seats={seats} onSeatClick={handleSeatClick} />

      {justTakenMsg && (
        <div
          role="alert"
          data-testid="just-taken-toast"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-amber-600 text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium"
        >
          {justTakenMsg}
        </div>
      )}
    </div>
  );
}
