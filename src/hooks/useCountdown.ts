import { useState, useEffect, useCallback } from "react";

export interface CountdownState {
  secondsLeft: number;
  expired: boolean;
  formatted: string;
}

function computeSecondsLeft(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 1000));
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function useCountdown(expiresAt: string): CountdownState {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    computeSecondsLeft(expiresAt),
  );

  const tick = useCallback(() => {
    setSecondsLeft(computeSecondsLeft(expiresAt));
  }, [expiresAt]);

  useEffect(() => {
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  return {
    secondsLeft,
    expired: secondsLeft <= 0,
    formatted: formatTime(secondsLeft),
  };
}
