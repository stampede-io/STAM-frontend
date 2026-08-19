import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCountdown } from "./useCountdown";

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes initial seconds from expiresAt", () => {
    const expiresAt = new Date(Date.now() + 120_000).toISOString();
    const { result } = renderHook(() => useCountdown(expiresAt));

    expect(result.current.secondsLeft).toBe(120);
    expect(result.current.expired).toBe(false);
    expect(result.current.formatted).toBe("2:00");
  });

  it("decrements each second", () => {
    const expiresAt = new Date(Date.now() + 5_000).toISOString();
    const { result } = renderHook(() => useCountdown(expiresAt));

    expect(result.current.secondsLeft).toBe(5);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.secondsLeft).toBe(4);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.secondsLeft).toBe(3);
  });

  it("stops at zero and marks expired", () => {
    const expiresAt = new Date(Date.now() + 2_000).toISOString();
    const { result } = renderHook(() => useCountdown(expiresAt));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.expired).toBe(true);
    expect(result.current.formatted).toBe("0:00");
  });

  it("formats minutes and seconds correctly", () => {
    const expiresAt = new Date(Date.now() + 65_000).toISOString();
    const { result } = renderHook(() => useCountdown(expiresAt));

    expect(result.current.formatted).toBe("1:05");
  });

  it("handles already-expired timestamp", () => {
    const expiresAt = new Date(Date.now() - 10_000).toISOString();
    const { result } = renderHook(() => useCountdown(expiresAt));

    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.expired).toBe(true);
  });
});
