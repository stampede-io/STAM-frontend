import { useMemo, useState } from "react";
import type { Seat, SeatAvailability } from "../types/seat";

const AVAILABILITY_STYLES: Record<SeatAvailability, string> = {
  AVAILABLE:
    "bg-green-500 hover:bg-green-400 cursor-pointer text-white",
  HELD: "bg-yellow-500 cursor-not-allowed text-black",
  CONFIRMED: "bg-gray-400 cursor-not-allowed text-white",
  EXPIRED: "bg-green-500 hover:bg-green-400 cursor-pointer text-white",
};

const AVAILABILITY_LABELS: Record<SeatAvailability, string> = {
  AVAILABLE: "Available",
  HELD: "Held",
  CONFIRMED: "Taken",
  EXPIRED: "Available",
};

interface SeatMapProps {
  seats: Seat[];
  onSeatClick?: (seat: Seat) => void;
}

export default function SeatMap({ seats, onSeatClick }: SeatMapProps) {
  const [toast, setToast] = useState<string | null>(null);

  const rows = useMemo(() => {
    const grouped = new Map<string, Seat[]>();
    for (const seat of seats) {
      const key = seat.rowLabel;
      const row = grouped.get(key);
      if (row) {
        row.push(seat);
      } else {
        grouped.set(key, [seat]);
      }
    }
    for (const row of grouped.values()) {
      row.sort((a, b) => a.seatNumber - b.seatNumber);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  function handleClick(seat: Seat) {
    if (seat.availability === "HELD" || seat.availability === "CONFIRMED") {
      setToast("Seat unavailable");
      setTimeout(() => setToast(null), 2000);
      return;
    }
    onSeatClick?.(seat);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="w-64 mx-auto mb-6 py-2 rounded-b-full bg-gray-700 text-center text-white text-sm font-semibold"
        aria-label="Stage"
      >
        STAGE
      </div>

      <div className="flex flex-col gap-2" role="grid" aria-label="Seat map">
        {rows.map(([rowLabel, rowSeats]) => (
          <div key={rowLabel} className="flex items-center gap-1" role="row">
            <span className="w-8 text-right text-sm font-mono text-gray-500 mr-2">
              {rowLabel}
            </span>
            {rowSeats.map((seat) => (
              <button
                key={seat.id}
                role="gridcell"
                aria-label={`Row ${seat.rowLabel} Seat ${seat.seatNumber} — ${AVAILABILITY_LABELS[seat.availability]}`}
                className={`w-9 h-9 rounded-t-lg text-xs font-bold transition-colors duration-200 ${AVAILABILITY_STYLES[seat.availability]}`}
                onClick={() => handleClick(seat)}
                data-testid={`seat-${seat.rowLabel}-${seat.seatNumber}`}
                data-availability={seat.availability}
              >
                {seat.seatNumber}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-4 mt-6 text-sm" aria-label="Legend">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-green-500" />
          Available
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-yellow-500" />
          Held
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded bg-gray-400" />
          Taken
        </span>
      </div>

      {toast && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
