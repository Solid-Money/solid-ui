import { useEffect, useState } from 'react';

const EMPTY_COUNTDOWN = '0D 0H 0M';

const formatNextSpinCountdown = (spinAvailable: boolean, lastSpinDate: string | null) => {
  if (spinAvailable || !lastSpinDate) {
    return EMPTY_COUNTDOWN;
  }

  const now = new Date();
  const nextUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const difference = nextUtcMidnight.getTime() - now.getTime();

  if (difference <= 0) {
    return EMPTY_COUNTDOWN;
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

  return `${days}D ${hours}H ${minutes}M`;
};

export const useNextSpinCountdown = (spinAvailable: boolean, lastSpinDate: string | null) => {
  const [countdown, setCountdown] = useState(() =>
    formatNextSpinCountdown(spinAvailable, lastSpinDate),
  );

  useEffect(() => {
    setCountdown(formatNextSpinCountdown(spinAvailable, lastSpinDate));

    if (spinAvailable || !lastSpinDate) {
      return;
    }

    const interval = setInterval(() => {
      setCountdown(formatNextSpinCountdown(spinAvailable, lastSpinDate));
    }, 1000);

    return () => clearInterval(interval);
  }, [spinAvailable, lastSpinDate]);

  return countdown;
};
