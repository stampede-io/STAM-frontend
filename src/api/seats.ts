import type { Seat } from "../types/seat";

export async function fetchSeats(showId: string): Promise<Seat[]> {
  const res = await fetch(`/api/v1/shows/${showId}/seats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch seats: ${res.status}`);
  }
  return res.json();
}
