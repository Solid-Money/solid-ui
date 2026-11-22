import { perfNow } from '@/lib/telemetry/perfClock';

/**
 * Where the time went in the last wallet balance read (hooks/useBalances): the
 * multi-chain reads, then the price lookups, and which chain was slowest. The
 * read fans out to 30-odd sources, so "tokens were slow" says nothing on its
 * own; this says which part was.
 *
 * Only stores the figures and tells listeners: lib/homeLoadTiming reports them,
 * so the balance hook never pulls analytics in with it.
 */
export type TokenFetchTiming = {
  /** {@link perfNow} time the read finished. */
  endedAt: number;
  totalMs: number;
  /** Balances, rates and native prices on every chain, read together. */
  readsMs: number;
  /** The price lookups for tokens the reads left unpriced. */
  pricingMs: number;
  tokenCount: number;
  unpricedCount: number;
  /** Reads given up on after their time budget, served from the last good read instead. */
  timedOutReads: number;
  failedChains: number[];
  slowestChain?: number;
  slowestChainMs?: number;
};

type Listener = (timing: TokenFetchTiming) => void;

let last: TokenFetchTiming | null = null;
const listeners = new Set<Listener>();

export const noteTokenFetchTiming = (timing: Omit<TokenFetchTiming, 'endedAt'>): void => {
  last = { ...timing, endedAt: perfNow() };
  for (const listener of listeners) {
    try {
      listener(last);
    } catch {
      // A listener's failure must never fail the balance read.
    }
  }
};

export const onTokenFetchTiming = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The last read that finished at or after `since` (a {@link perfNow} time), if any. */
export const getTokenFetchTimingSince = (since: number): TokenFetchTiming | null =>
  last && last.endedAt >= since ? last : null;
