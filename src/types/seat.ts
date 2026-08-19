export type SeatAvailability =
  | "AVAILABLE"
  | "HELD"
  | "CONFIRMED"
  | "EXPIRED";

export interface Seat {
  id: string;
  showId: string;
  section: string;
  rowLabel: string;
  seatNumber: number;
  priceCents: number;
  availability: SeatAvailability;
}
