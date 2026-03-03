"use client";

import { useEffect, useState } from "react";

export const FIVE_MINUTES_MS = 300000;

interface UseCategoryLockStateParams {
  isSecured: boolean;
  lastUnlockTimestamp: number;
}

export function useCategoryLockState({
  isSecured,
  lastUnlockTimestamp,
}: UseCategoryLockStateParams) {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);

    return () => window.clearInterval(interval);
  }, []);

  const timeSinceLastUnlock =
    lastUnlockTimestamp > 0
      ? currentTime - lastUnlockTimestamp
      : Number.POSITIVE_INFINITY;

  const isLocked = isSecured && timeSinceLastUnlock > FIVE_MINUTES_MS;
  const secondsRemaining =
    isSecured && !isLocked
      ? Math.max(
          0,
          Math.ceil((FIVE_MINUTES_MS - Math.max(0, timeSinceLastUnlock)) / 1000),
        )
      : null;

  return { isLocked, secondsRemaining };
}
