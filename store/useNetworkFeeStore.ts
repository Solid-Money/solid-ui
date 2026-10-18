import { create } from 'zustand';

/** A transaction our paymaster won't sponsor, waiting for the user's answer. */
export interface NetworkFeeRequest {
  chainId: number;
  /** e.g. `Ethereum`. */
  network: string;
  /** The chain's gas token, e.g. `ETH`. */
  symbol: string;
  decimals: number;
  /** Worst-case fee in the gas token's base units; the unused part is refunded. */
  maxFee: bigint;
}

interface NetworkFeeState {
  isOpen: boolean;
  request?: NetworkFeeRequest;
  resolve?: (accepted: boolean) => void;
  ask: (request: NetworkFeeRequest) => Promise<boolean>;
  answer: (accepted: boolean) => void;
}

/**
 * The "pay the network fee yourself?" sheet, one for the whole app, mounted in
 * `DeferredModalProviders` like the failure sheet. `executeTransactions` awaits
 * the answer before the passkey prompt.
 */
export const useNetworkFeeStore = create<NetworkFeeState>()((set, get) => ({
  isOpen: false,
  request: undefined,
  resolve: undefined,
  ask: request =>
    new Promise<boolean>(resolve => {
      // A newer transaction supersedes one still asking: that one is declined.
      get().resolve?.(false);
      set({ isOpen: true, request, resolve });
    }),
  // The request stays until the next ask so the sheet can animate out with it.
  answer: accepted => {
    const { resolve } = get();
    set({ isOpen: false, resolve: undefined });
    resolve?.(accepted);
  },
}));

/** Ask the user to pay a transaction's network fee. Resolves to their answer. */
export const askToPayNetworkFee = (request: NetworkFeeRequest) =>
  useNetworkFeeStore.getState().ask(request);
