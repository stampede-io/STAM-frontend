import { useParams } from "react-router-dom";
import { useState } from "react";
import SeatMap from "../components/SeatMap";
import { useSeatAvailability } from "../hooks/useSeatAvailability";
import type { Seat } from "../types/seat";

export default function SeatMapPage() {
  const { showId } = useParams<{ showId: string }>();
  const { seats, loading, error, refresh } = useSeatAvailability(showId);
  const [justTakenMsg, setJustTakenMsg] = useState<string | null>(null);

  async function handleSeatClick(seat: Seat) {
    try {
      const res = await fetch(`/api/v1/shows/${showId}/seats/${seat.id}/hold`, {
        method: "POST",
      });

      if (res.status === 409) {
        setJustTakenMsg("That seat was just taken — please select another");
        setTimeout(() => setJustTakenMsg(null), 3000);
        await refresh();
        return;
      }

      if (!res.ok) {
        throw new Error(`Hold failed: ${res.status}`);
      }

      await refresh();
    } catch (err) {
      setJustTakenMsg(
        err instanceof Error ? err.message : "Something went wrong",
      );
      setTimeout(() => setJustTakenMsg(null), 3000);
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
