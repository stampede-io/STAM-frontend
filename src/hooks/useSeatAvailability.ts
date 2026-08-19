import { useCallback, useEffect, useRef, useState } from "react";
import type { Seat } from "../types/seat";
import { fetchSeats } from "../api/seats";

const POLL_INTERVAL_MS = 5_000;

interface UseSeatAvailabilityResult {
  seats: Seat[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSeatAvailability(
  showId: string | undefined,
): UseSeatAvailabilityResult {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!showId) return;
    try {
      const data = await fetchSeats(showId);
      setSeats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    void load();

    intervalRef.current = setInterval(() => void load(), POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  return { seats, loading, error, refresh: load };
}
