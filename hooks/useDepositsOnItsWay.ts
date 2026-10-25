import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  amountOnItsWay,
  type DepositOnItsWay,
  depositsOnItsWay,
  nextDepositChangeAt,
} from '@/lib/deposit/depositOnItsWay';
import { useActivityStore } from '@/store/useActivityStore';
import { useUserStore } from '@/store/useUserStore';

/**
 * USD Yield deposits from the Solid wallet that haven't reached Earn yet (or didn't go
 * through), read from the Activity store. Reads the store only, so any screen can show
 * them without starting an activity fetch of its own.
 */
export function useDepositsOnItsWay(): {
  deposits: DepositOnItsWay[];
  /** Dollars still on their way, failed deposits left out. */
  amountOnItsWay: number;
} {
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const events = useActivityStore(useShallow(state => (userId ? state.events[userId] : undefined)));
  const [now, setNow] = useState(() => Date.now());

  const deposits = useMemo(() => depositsOnItsWay(events ?? [], now), [events, now]);

  // A row turns "taking longer" (or drops off) with time alone, so look again then.
  const nextChangeAt = nextDepositChangeAt(deposits);
  useEffect(() => {
    if (nextChangeAt === undefined) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(nextChangeAt - Date.now(), 0));
    return () => clearTimeout(timer);
  }, [nextChangeAt]);

  return { deposits, amountOnItsWay: amountOnItsWay(deposits) };
}
