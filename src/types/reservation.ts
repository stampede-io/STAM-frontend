export interface Reservation {
  reservationId: string;
  showId: string;
  seatId: string;
  section: string;
  rowLabel: string;
  seatNumber: number;
  priceCents: number;
  expiresAt: string;
}
