import { useEffect, useState } from 'react';

function formatTimeUntilMidnightUTC(): string {
  const now = new Date();
  const nextUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const difference = nextUtcMidnight.getTime() - now.getTime();

  const hours = Math.floor(difference / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}H ${minutes}M`;
}

export function useNextSpinCountdown(spinAvailable: boolean): string {
  const [countdown, setCountdown] = useState(() => formatTimeUntilMidnightUTC());

  useEffect(() => {
    if (spinAvailable) {
      return;
    }

    setCountdown(formatTimeUntilMidnightUTC());

    const interval = setInterval(() => {
      setCountdown(formatTimeUntilMidnightUTC());
    }, 60_000);

    return () => clearInterval(interval);
  }, [spinAvailable]);

  return countdown;
}
