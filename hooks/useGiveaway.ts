import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { minutesToMilliseconds, secondsToMilliseconds } from 'date-fns';

import { fetchCurrentGiveaway, fetchGiveawayWinners } from '@/lib/api/spin-win';
import { useSpinWinStore } from '@/store/useSpinWinStore';

const SPIN_WIN = 'spin-win';

/** Returns a refetch interval based on how close the giveaway draw is */
const getRefetchInterval = (giveawayDate: string | undefined): number => {
  if (!giveawayDate) return minutesToMilliseconds(5);

  const timeUntilDraw = new Date(giveawayDate).getTime() - Date.now();

  // Less than 1 minute away: poll every 10 seconds
  if (timeUntilDraw <= minutesToMilliseconds(1)) {
    return secondsToMilliseconds(10);
  }

  // Less than 10 minutes away: poll every 30 seconds
  if (timeUntilDraw <= minutesToMilliseconds(10)) {
    return secondsToMilliseconds(30);
  }

  // Less than 1 hour away: poll every 2 minutes
  if (timeUntilDraw <= minutesToMilliseconds(60)) {
    return minutesToMilliseconds(2);
  }

  // Default: poll every 5 minutes
  return minutesToMilliseconds(5);
};

export const useCurrentGiveaway = () => {
  const setGiveaway = useSpinWinStore(state => state.setGiveaway);

  const query = useQuery({
    queryKey: [SPIN_WIN, 'giveaway'],
    queryFn: async () => {
      const data = await fetchCurrentGiveaway();
      setGiveaway(data);
      return data;
    },
    staleTime: secondsToMilliseconds(30),
    gcTime: minutesToMilliseconds(10),
    refetchInterval: query => getRefetchInterval(query.state.data?.giveawayDate),
  });

  return query;
};

export const useGiveawayWinners = () => {
  return useQuery({
    queryKey: [SPIN_WIN, 'giveaway', 'winners'],
    queryFn: fetchGiveawayWinners,
    staleTime: minutesToMilliseconds(5),
    gcTime: minutesToMilliseconds(10),
  });
};

export const useGiveawayCountdown = (giveawayDate: string | undefined) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const setGiveawayTimeRemaining = useSpinWinStore(state => state.setGiveawayTimeRemaining);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const calculateTimeLeft = useCallback(() => {
    if (!giveawayDate) return '0D 0H 0M 0S';

    const difference = new Date(giveawayDate).getTime() - Date.now();

    if (difference <= 0) return '0D 0H 0M 0S';

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    if (days > 0) {
      return `${days}D ${hours}H ${minutes}M ${seconds}S`;
    }

    return `${hours}H ${minutes}M ${seconds}S`;
  }, [giveawayDate]);

  useEffect(() => {
    if (!giveawayDate) {
      setTimeRemaining('0D 0H 0M 0S');
      setGiveawayTimeRemaining(0);
      return;
    }

    // Set initial value
    const initial = calculateTimeLeft();
    setTimeRemaining(initial);
    setGiveawayTimeRemaining(new Date(giveawayDate).getTime() - Date.now());

    // Update every second
    intervalRef.current = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeRemaining(remaining);

      const ms = new Date(giveawayDate).getTime() - Date.now();
      setGiveawayTimeRemaining(Math.max(0, ms));

      // Clear interval when countdown reaches zero
      if (remaining === '0D 0H 0M 0S' && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [giveawayDate, calculateTimeLeft, setGiveawayTimeRemaining]);

  return timeRemaining;
};
