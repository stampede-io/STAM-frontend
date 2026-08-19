import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import SeatMap from "./SeatMap";
import type { Seat } from "../types/seat";

function makeSeat(overrides: Partial<Seat> = {}): Seat {
  return {
    id: crypto.randomUUID(),
    showId: "show-1",
    section: "A",
    rowLabel: "A",
    seatNumber: 1,
    priceCents: 5000,
    availability: "AVAILABLE",
    ...overrides,
  };
}

const MOCK_SEATS: Seat[] = [
  makeSeat({ rowLabel: "A", seatNumber: 1, availability: "AVAILABLE" }),
  makeSeat({ rowLabel: "A", seatNumber: 2, availability: "HELD" }),
  makeSeat({ rowLabel: "A", seatNumber: 3, availability: "CONFIRMED" }),
  makeSeat({ rowLabel: "B", seatNumber: 1, availability: "AVAILABLE" }),
  makeSeat({ rowLabel: "B", seatNumber: 2, availability: "AVAILABLE" }),
];

describe("SeatMap", () => {
  it("renders the correct number of seats", () => {
    render(<SeatMap seats={MOCK_SEATS} />);
    const buttons = screen.getAllByRole("gridcell");
    expect(buttons).toHaveLength(5);
  });

  it("renders available seats with green background", () => {
    render(<SeatMap seats={MOCK_SEATS} />);
    const seat = screen.getByTestId("seat-A-1");
    expect(seat.className).toContain("bg-green-500");
    expect(seat.dataset.availability).toBe("AVAILABLE");
  });

  it("renders held seats with yellow background", () => {
    render(<SeatMap seats={MOCK_SEATS} />);
    const seat = screen.getByTestId("seat-A-2");
    expect(seat.className).toContain("bg-yellow-500");
    expect(seat.dataset.availability).toBe("HELD");
  });

  it("renders confirmed seats with gray background", () => {
    render(<SeatMap seats={MOCK_SEATS} />);
    const seat = screen.getByTestId("seat-A-3");
    expect(seat.className).toContain("bg-gray-400");
    expect(seat.dataset.availability).toBe("CONFIRMED");
  });

  it("calls onSeatClick for available seats", async () => {
    const onClick = vi.fn();
    render(<SeatMap seats={MOCK_SEATS} onSeatClick={onClick} />);
    await userEvent.click(screen.getByTestId("seat-B-1"));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onClick.mock.calls[0]![0]!.availability).toBe("AVAILABLE");
  });

  it("shows 'Seat unavailable' toast when clicking a held seat", async () => {
    render(<SeatMap seats={MOCK_SEATS} />);
    await userEvent.click(screen.getByTestId("seat-A-2"));
    expect(screen.getByRole("alert")).toHaveTextContent("Seat unavailable");
  });

  it("groups seats into rows", () => {
    render(<SeatMap seats={MOCK_SEATS} />);
    const rowElements = screen.getAllByRole("row");
    expect(rowElements).toHaveLength(2);
  });
});
