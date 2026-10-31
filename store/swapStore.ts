import {
  createContext,
  createElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  ADDRESS_ZERO,
  computePoolAddress,
  Currency,
  CurrencyAmount,
  Percent,
  TickMath,
  Trade,
  TradeType,
  tryParseAmount,
} from '@cryptoalgebra/fuse-sdk';
import JSBI from 'jsbi';
import { Address } from 'viem';
import { fuse } from 'viem/chains';
import { useBalance } from 'wagmi';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import { SWAP_MODAL } from '@/constants/modals';
import { isLifiRoute, SolidBridgeRoute, solidBridgeRoute } from '@/constants/swapChains';
import { soUSDC_TOKEN, USDC_STARGATE_TOKEN } from '@/constants/tokens';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useReadAlgebraPoolGlobalState, useReadAlgebraPoolTickSpacing } from '@/generated/wagmi';
import { BestTrade, useBestTrade } from '@/hooks/swap/useBestTrade';
import { useQuoteInput } from '@/hooks/swap/useQuoteInput';
import useSwapSlippageTolerance from '@/hooks/swap/useSwapSlippageTolerance';
import { useCurrency } from '@/hooks/tokens/useCurrency';
import { useSwapFeeRate } from '@/hooks/useProductFees';
import useUser from '@/hooks/useUser';
import { track } from '@/lib/analytics';
import { getSwapFundingError } from '@/lib/swapFunding';
import { RewardsTier, SwapModal, TransactionStatusModal } from '@/lib/types';
import { LifiRouteOrder, SwapAsset } from '@/lib/types/lifi-swap';
import { SwapField, SwapFieldType } from '@/lib/types/swap-field';
import { TradeState } from '@/lib/types/trade-state';
import { computeSwapFee, noSwapFee, SwapFee, SwapFeeBasis } from '@/lib/utils/swapFee';

interface SwapState {
  readonly independentField: SwapFieldType;
  readonly typedValue: string;
  readonly [SwapField.INPUT]: SwapFieldSelection;
  readonly [SwapField.OUTPUT]: SwapFieldSelection;
  readonly wasInverted: boolean;
  /** Route preference for a swap that leaves Fuse. Kept for the session. */
  readonly lifiRouteOrder: LifiRouteOrder;
  readonly lastFocusedField: SwapFieldType;
  readonly currentModal: SwapModal;
  readonly previousModal: SwapModal;
  readonly buyFuseTier: RewardsTier | undefined;
  readonly buyFuseUpgrade: BuyFuseUpgradeContext | undefined;
  /** The last swap the new flow made, for its done and on-its-way screens. */
  readonly receipt: SwapReceipt | undefined;
  readonly transaction: TransactionStatusModal & {
    inputCurrencySymbol?: string;
    outputCurrencySymbol?: string;
    transactionHash?: string;
    chainId?: number;
  };
  actions: {
    /** `chainId` defaults to Fuse, where every caller outside the picker selects. */
    selectCurrency: (
      field: SwapFieldType,
      currencyId: string | undefined,
      chainId?: number,
    ) => void;
    switchCurrencies: () => void;
    typeInput: (field: SwapFieldType, typedValue: string) => void;
    resetForm: () => void;
    setModal: (modal: SwapModal) => void;
    openBuyFuse: (tier?: RewardsTier, upgrade?: { depositToSavings: boolean }) => void;
    setTransaction: (transaction: SwapState['transaction']) => void;
    setLifiRouteOrder: (order: LifiRouteOrder) => void;
    setReceipt: (receipt: SwapReceipt | undefined) => void;
    /**
     * Opens the swap form from a screen, on the pair that screen implies and
     * with no amount (or `amount`), and records where it was opened from.
     */
    openSwap: (options: OpenSwapOptions) => void;
  };
}

/** Where a swap was opened from, for `swap_modal_viewed`. */
export type SwapEntryPoint =
  | 'home'
  | 'coin_page'
  | 'savings'
  | 'dashboard'
  | 'card_fund'
  | 'not_enough_to_pay'
  | 'swap_arrival'
  | 'unknown';

/** A swap the new flow made, as its outcome screens show it. */
export interface SwapReceipt {
  /** `bridging` until the coin lands on the other network. */
  kind: 'completed' | 'bridging';
  fromAmount: number;
  fromName: string;
  toAmount: number;
  toName: string;
  toAsset: SwapAsset;
  feeUsd: number | undefined;
  completedAt: number;
  transactionHash: string;
  fromChainId: number;
  toChainId: number;
  /** The cross-network swap the tracker follows (lifiSwapStore). */
  clientTxId?: string;
  /** Set when it went over Solid's bridge, which the backend tracks by `sendId`. */
  bridge?: {
    sendId: string;
    /** Decimals of the coin sent, which the send's amounts are in. */
    sentDecimals: number;
    /** What landed and what the user asked for, when a swap on Fuse follows. */
    thenSwap?: {
      landsAs: { chainId: number; address: string };
      landsAsName: string;
      to: { chainId: number; address: string };
    };
  };
}

export interface OpenSwapOptions {
  entryPoint: SwapEntryPoint;
  /** "You pay". The current one stays when left out. */
  input?: { address: string; chainId: number };
  /** "You get". The current one stays when left out. */
  output?: { address: string; chainId: number };
  /** Typed into "You pay" once the form opens. */
  amount?: string;
}

/** A token on a chain. Fuse on both sides is an Algebra swap; anything else goes through LI.FI. */
interface SwapFieldSelection {
  readonly currencyId: Address | undefined;
  readonly chainId: number;
}

const sameSelection = (a: SwapFieldSelection, b: SwapFieldSelection) =>
  a.chainId === b.chainId &&
  !!a.currencyId &&
  a.currencyId.toLowerCase() === b.currencyId?.toLowerCase();

export interface BuyFuseUpgradeContext {
  tier: RewardsTier;
  depositToSavings: boolean;
}

export const useSwapState = create<SwapState>((set, get) => ({
  independentField: SwapField.INPUT,
  typedValue: '',
  // USD Yield to USDC until a screen opens the form on another pair.
  [SwapField.INPUT]: {
    currencyId: soUSDC_TOKEN.address as Address,
    chainId: fuse.id,
  },
  [SwapField.OUTPUT]: {
    currencyId: USDC_STARGATE_TOKEN.address as Address,
    chainId: fuse.id,
  },
  wasInverted: false,
  lifiRouteOrder: 'CHEAPEST',
  lastFocusedField: SwapField.INPUT,
  currentModal: SWAP_MODAL.CLOSE,
  previousModal: SWAP_MODAL.CLOSE,
  buyFuseTier: undefined,
  buyFuseUpgrade: undefined,
  transaction: {},
  receipt: undefined,
  actions: {
    selectCurrency: (field, currencyId, chainId = fuse.id) => {
      const otherField = field === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT;
      const selection = { currencyId: currencyId as Address | undefined, chainId };

      if (sameSelection(selection, get()[otherField])) {
        const pair = { [field]: selection, [otherField]: get()[field] } as SwapPair;
        set({ ...pair, ...entryField(pair, flip(get().independentField)) });
      } else {
        const pair = { ...pickPair(get()), [field]: selection } as SwapPair;
        set({ [field]: selection, ...entryField(pair, get().independentField) });
      }
    },
    switchCurrencies: () => {
      const pair = {
        [SwapField.INPUT]: get()[SwapField.OUTPUT],
        [SwapField.OUTPUT]: get()[SwapField.INPUT],
      } as SwapPair;
      set({ ...pair, ...entryField(pair, flip(get().independentField)) });
    },
    typeInput: (field, typedValue) =>
      set({
        independentField: field,
        lastFocusedField: field,
        typedValue,
      }),
    resetForm: () =>
      set({
        independentField: SwapField.INPUT,
        typedValue: '',
        lastFocusedField: SwapField.INPUT,
      }),
    setModal: modal =>
      set({
        previousModal: get().currentModal,
        currentModal: modal,
        ...(modal.name === SWAP_MODAL.CLOSE.name ? { buyFuseUpgrade: undefined } : {}),
      }),
    openBuyFuse: (tier, upgrade) =>
      set({
        previousModal: get().currentModal,
        currentModal: SWAP_MODAL.OPEN_BUY_FUSE,
        buyFuseTier: tier,
        buyFuseUpgrade: tier && upgrade ? { tier, ...upgrade } : undefined,
      }),
    setTransaction: transaction => set({ transaction }),
    setLifiRouteOrder: lifiRouteOrder => set({ lifiRouteOrder }),
    setReceipt: receipt => set({ receipt }),
    openSwap: ({ entryPoint, input, output, amount }) => {
      const { selectCurrency } = get().actions;
      // Both at once: one after the other could briefly match the old other
      // side and flip the pair.
      if (input && output) {
        const pair = {
          [SwapField.INPUT]: { currencyId: input.address as Address, chainId: input.chainId },
          [SwapField.OUTPUT]: { currencyId: output.address as Address, chainId: output.chainId },
        } as SwapPair;
        set({ ...pair, ...entryField(pair, SwapField.INPUT) });
      } else if (input) {
        selectCurrency(SwapField.INPUT, input.address, input.chainId);
      } else if (output) {
        selectCurrency(SwapField.OUTPUT, output.address, output.chainId);
      }
      set({
        independentField: SwapField.INPUT,
        lastFocusedField: SwapField.INPUT,
        typedValue: amount ?? '',
        previousModal: get().currentModal,
        currentModal: SWAP_MODAL.OPEN_FORM,
      });
      const state = get();
      track(TRACKING_EVENTS.SWAP_MODAL_VIEWED, {
        entry_point: entryPoint,
        input_chain_id: state[SwapField.INPUT].chainId,
        input_token: state[SwapField.INPUT].currencyId,
        output_chain_id: state[SwapField.OUTPUT].chainId,
        output_token: state[SwapField.OUTPUT].currencyId,
        has_amount: !!amount,
      });
    },
  },
}));

type SwapPair = Pick<SwapState, typeof SwapField.INPUT | typeof SwapField.OUTPUT>;

const flip = (field: SwapFieldType): SwapFieldType =>
  field === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT;

const pickPair = (state: SwapState): SwapPair => ({
  [SwapField.INPUT]: state[SwapField.INPUT],
  [SwapField.OUTPUT]: state[SwapField.OUTPUT],
});

/**
 * Which field the amount is typed into once `pair` is selected.
 *
 * A Fuse pair keeps the field the Algebra form would have used. A pair that
 * leaves Fuse is exact-in only, so it always types into the input, and an
 * amount that was typed as an output is cleared rather than reread as an input.
 */
function entryField(
  pair: SwapPair,
  preferred: SwapFieldType,
): Pick<SwapState, 'independentField' | 'lastFocusedField'> & { typedValue?: string } {
  if (!isLifiRoute(pair[SwapField.INPUT].chainId, pair[SwapField.OUTPUT].chainId)) {
    return { independentField: preferred, lastFocusedField: preferred };
  }
  return {
    independentField: SwapField.INPUT,
    lastFocusedField: SwapField.INPUT,
    ...(preferred === SwapField.OUTPUT ? { typedValue: '' } : {}),
  };
}

/** The move over Solid's bridge the pair takes, if it takes one. */
export function useSolidBridgeRoute(): SolidBridgeRoute | undefined {
  const { input, output } = useSwapState(
    useShallow(state => ({ input: state[SwapField.INPUT], output: state[SwapField.OUTPUT] })),
  );
  return useMemo(
    () =>
      input.currencyId && output.currencyId
        ? solidBridgeRoute(
            { chainId: input.chainId, address: input.currencyId },
            { chainId: output.chainId, address: output.currencyId },
          )
        : undefined,
    [input.chainId, input.currencyId, output.chainId, output.currencyId],
  );
}

/** True when the pair leaves Fuse and the LI.FI form should render. */
export function useIsLifiSwap(): boolean {
  return useSwapState(state =>
    isLifiRoute(state[SwapField.INPUT].chainId, state[SwapField.OUTPUT].chainId),
  );
}

export function useSwapActionHandlers(): {
  onCurrencySelection: (field: SwapFieldType, currency: Currency) => void;
  onAssetSelection: (field: SwapFieldType, asset: SwapAsset) => void;
  onSwitchTokens: () => void;
  onUserInput: (field: SwapFieldType, typedValue: string) => void;
} {
  const { selectCurrency, switchCurrencies, typeInput } = useSwapState(
    useShallow(state => ({
      selectCurrency: state.actions.selectCurrency,
      switchCurrencies: state.actions.switchCurrencies,
      typeInput: state.actions.typeInput,
    })),
  );

  const onCurrencySelection = useCallback(
    (field: SwapFieldType, currency: Currency) =>
      selectCurrency(
        field,
        currency.isToken ? currency.address : currency.isNative ? ADDRESS_ZERO : '',
      ),
    [selectCurrency],
  );

  const onAssetSelection = useCallback(
    (field: SwapFieldType, asset: SwapAsset) =>
      selectCurrency(field, asset.isNative ? ADDRESS_ZERO : asset.address, asset.chainId),
    [selectCurrency],
  );

  const onSwitchTokens = useCallback(() => {
    switchCurrencies();
  }, [switchCurrencies]);

  const onUserInput = useCallback(
    (field: SwapFieldType, typedValue: string) => {
      typeInput(field, typedValue);
    },
    [typeInput],
  );

  return {
    onSwitchTokens,
    onCurrencySelection,
    onAssetSelection,
    onUserInput,
  };
}

/** A typed amount that hasn't been quoted yet reads as a quote in flight. */
const PENDING_QUOTE: Omit<BestTrade, 'requote'> = { state: TradeState.LOADING, trade: null };

/**
 * Everything the swap form shows and acts on:
 * - `currencies`: An object mapping swap fields to their respective currencies.
 * - `currencyBalances`: An object mapping swap fields to their respective currency balances.
 * - `parsedAmount`: The parsed amount of currency.
 * - `inputError`: An optional string indicating any input errors.
 * - `tradeState`: An object containing the trade details and state.
 * - `toggledTrade`: The toggled trade details.
 * - `tickAfterSwap`: The tick value after the swap.
 * - `allowedSlippage`: The allowed slippage percentage.
 * - `poolFee`: The pool fee percentage.
 * - `tick`: The current tick value.
 * - `tickSpacing`: The tick spacing value.
 * - `poolAddress`: The address of the pool.
 */
export interface DerivedSwapInfo {
  currencies: { [field in SwapFieldType]?: Currency };
  currencyBalances: { [field in SwapFieldType]?: CurrencyAmount<Currency> };
  /** What's typed, parsed. The quote trails it by a moment while typing. */
  parsedAmount: CurrencyAmount<Currency> | undefined;
  inputError?: string;
  tradeState: Omit<BestTrade, 'requote'>;
  toggledTrade: Trade<Currency, Currency, TradeType> | undefined;
  tickAfterSwap: number | null | undefined;
  allowedSlippage: Percent;
  poolFee: number | undefined;
  tick: number | undefined;
  tickSpacing: number | undefined;
  poolAddress: Address | undefined;
  /**
   * Solid's fee on this swap, sized from the user's tier.
   *
   * `swapAmount` is what the route was quoted on, so the output shown already
   * accounts for the fee; `feeAmount` is what the batch transfers to the revenue
   * wallet. Both are zero for a tier that pays nothing.
   */
  swapFee: SwapFee;
  /** Where the fee must be sent. Undefined means "don't collect one". */
  revenueWalletAddress: string | undefined;
  /**
   * Re-quotes the trade on screen just before it's signed. Resolves false when
   * the price has moved past the slippage limit, so the swap would revert; by
   * then the form is showing the fresh quote.
   */
  refreshQuote: () => Promise<boolean>;
}

const DerivedSwapInfoContext = createContext<DerivedSwapInfo | undefined>(undefined);

/**
 * Works out the swap form's quote, balances and fees once, for every component
 * inside it that calls `useDerivedSwapInfo`.
 */
export function DerivedSwapInfoProvider({ children }: { children: ReactNode }) {
  const info = useSwapInfo();
  return createElement(DerivedSwapInfoContext.Provider, { value: info }, children);
}

/** The swap form's derived state, from the nearest `DerivedSwapInfoProvider`. */
export function useDerivedSwapInfo(): DerivedSwapInfo {
  const info = useContext(DerivedSwapInfoContext);
  if (!info) {
    throw new Error('useDerivedSwapInfo must be used inside a DerivedSwapInfoProvider');
  }
  return info;
}

function useSwapInfo(): DerivedSwapInfo {
  const { user } = useUser();
  const account = user?.safeAddress;
  const { independentField, typedValue, inputCurrencyId, outputCurrencyId } = useSwapState(
    useShallow(state => ({
      independentField: state.independentField,
      typedValue: state.typedValue,
      inputCurrencyId: state[SwapField.INPUT].currencyId,
      outputCurrencyId: state[SwapField.OUTPUT].currencyId,
    })),
  );

  const inputCurrency = useCurrency(inputCurrencyId);
  const outputCurrency = useCurrency(outputCurrencyId);

  // What's typed drives whatever should keep up with the keyboard...
  const parsedAmount = useMemo(
    () =>
      tryParseAmount(
        typedValue,
        (independentField === SwapField.INPUT ? inputCurrency : outputCurrency) ?? undefined,
      ),
    [typedValue, independentField, inputCurrency, outputCurrency],
  );

  // ...while the quote, and the fee sized with it, follow once typing pauses.
  const quoteInput = useQuoteInput(independentField, typedValue);
  const isExactIn: boolean = quoteInput.independentField === SwapField.INPUT;
  const amountToQuote = useMemo(
    () =>
      tryParseAmount(
        quoteInput.typedValue,
        (isExactIn ? inputCurrency : outputCurrency) ?? undefined,
      ),
    [quoteInput.typedValue, isExactIn, inputCurrency, outputCurrency],
  );

  const { rate: swapFeeRate, revenueWalletAddress } = useSwapFeeRate();

  /**
   * The fee carved out of an exact-in swap, and the amount left to route.
   *
   * Sized before quoting so the route is priced on what will actually be
   * swapped: quoting the full amount and transferring the fee on top would show
   * an output the user cannot receive, and would need funds beyond what they
   * typed (breaking a max-balance swap outright).
   *
   * Exact-out is the other way round — the input is whatever the route needs, so
   * its fee is added on top once the trade resolves, below.
   */
  const inputSideFee = useMemo(() => {
    if (!isExactIn || !amountToQuote) return undefined;
    return computeSwapFee({
      amount: BigInt(amountToQuote.quotient.toString()),
      rate: swapFeeRate,
      basis: SwapFeeBasis.DeductedFromInput,
    });
  }, [isExactIn, amountToQuote, swapFeeRate]);

  /** What the router quotes: the net amount on exact-in, the target on exact-out. */
  const amountToRoute = useMemo(() => {
    if (!amountToQuote) return undefined;
    if (!inputSideFee || inputSideFee.feeAmount <= 0n) return amountToQuote;
    return CurrencyAmount.fromRawAmount(amountToQuote.currency, inputSideFee.swapAmount.toString());
  }, [amountToQuote, inputSideFee]);

  const bestTrade = useBestTrade(
    isExactIn ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT,
    amountToRoute,
    inputCurrency ?? undefined,
    outputCurrency ?? undefined,
  );
  const currentTrade = quoteInput.pending ? PENDING_QUOTE : bestTrade;

  // Logged once per distinct quote, not on every render that rebuilds the same one.
  const lastLoggedQuote = useRef('');
  useEffect(() => {
    if (!amountToQuote || currentTrade.state === TradeState.LOADING) return;

    const trade = currentTrade.trade;
    const summary = {
      direction: isExactIn ? 'exact-in' : 'exact-out',
      amount: `${amountToQuote.toExact()} ${amountToQuote.currency.symbol}`,
      routedAmount: amountToRoute?.toExact(),
      state: currentTrade.state,
      ...(trade && {
        path: trade.route.tokenPath.map(token => token.symbol).join(' → '),
        in: trade.inputAmount.toExact(),
        out: trade.outputAmount.toExact(),
      }),
    };

    const key = JSON.stringify(summary);
    if (key === lastLoggedQuote.current) return;
    lastLoggedQuote.current = key;
    console.log('[swap-quote] algebra quote', summary);

    // SYNCING is a refresh of a price already on screen, not a new one.
    if (currentTrade.state === TradeState.SYNCING) return;
    const priceProps = {
      trade_type: 'standard',
      surface:
        useSwapState.getState().currentModal.name === SWAP_MODAL.OPEN_BUY_FUSE.name
          ? 'buy_fuse'
          : 'swap',
      input_currency: inputCurrency?.symbol,
      output_currency: outputCurrency?.symbol,
      from_chain_id: fuse.id,
      to_chain_id: fuse.id,
      input_amount: amountToQuote.toExact(),
    };
    if (currentTrade.state === TradeState.VALID && trade) {
      track(TRACKING_EVENTS.SWAP_PRICE_SHOWN, {
        ...priceProps,
        output_amount: trade.outputAmount.toExact(),
      });
    } else {
      track(TRACKING_EVENTS.SWAP_PRICE_FAILED, {
        ...priceProps,
        error_code:
          currentTrade.state === TradeState.NO_ROUTE_FOUND ? 'NO_ROUTE' : 'QUOTE_UNAVAILABLE',
      });
    }
  }, [
    amountToQuote,
    amountToRoute,
    isExactIn,
    currentTrade.state,
    currentTrade.trade,
    inputCurrency?.symbol,
    outputCurrency?.symbol,
  ]);

  const [addressA, addressB] = [
    inputCurrency?.isNative ? undefined : inputCurrency?.address || '',
    outputCurrency?.isNative ? undefined : outputCurrency?.address || '',
  ] as Address[];

  const { data: inputCurrencyBalance } = useBalance({
    address: account,
    token: addressA,
    chainId: fuse.id,
    query: {
      enabled: !!account && !!addressA,
    },
  });

  const { data: outputCurrencyBalance } = useBalance({
    address: account,
    token: addressB,
    chainId: fuse.id,
    query: {
      enabled: !!account && !!addressB,
    },
  });

  const currencyBalances = {
    [SwapField.INPUT]:
      inputCurrency &&
      inputCurrencyBalance &&
      CurrencyAmount.fromRawAmount(inputCurrency, inputCurrencyBalance.value.toString()),
    [SwapField.OUTPUT]:
      outputCurrency &&
      outputCurrencyBalance &&
      CurrencyAmount.fromRawAmount(outputCurrency, outputCurrencyBalance.value.toString()),
  };

  const currencies: { [field in SwapFieldType]?: Currency } = {
    [SwapField.INPUT]: inputCurrency ?? undefined,
    [SwapField.OUTPUT]: outputCurrency ?? undefined,
  };

  let inputError: string | undefined;
  if (!account) {
    inputError = `Connect Wallet`;
  }

  if (typedValue !== '' && !parsedAmount) {
    inputError = inputError ?? `Enter an amount`;
  }

  if (!currencies[SwapField.INPUT] || !currencies[SwapField.OUTPUT]) {
    inputError = inputError ?? `Select a token`;
  }

  const toggledTrade = currentTrade.trade ?? undefined;

  const tickAfterSwap =
    currentTrade.priceAfterSwap &&
    TickMath.getTickAtSqrtRatio(
      JSBI.BigInt(currentTrade.priceAfterSwap[currentTrade.priceAfterSwap.length - 1].toString()),
    );

  const allowedSlippage = useSwapSlippageTolerance(toggledTrade);

  const { requote } = bestTrade;
  const refreshQuote = useCallback(async () => {
    const trade = currentTrade.trade;
    if (!trade) return false;

    let freshAmount: bigint | undefined;
    try {
      freshAmount = await requote();
    } catch {
      // Couldn't re-check; the slippage limit still guards the swap on-chain.
      return true;
    }
    if (freshAmount === undefined) return true;

    return trade.tradeType === TradeType.EXACT_INPUT
      ? !trade.minimumAmountOut(allowedSlippage).greaterThan(freshAmount.toString())
      : !trade.maximumAmountIn(allowedSlippage).lessThan(freshAmount.toString());
  }, [currentTrade.trade, requote, allowedSlippage]);

  /**
   * The fee on this swap, whichever side it comes from.
   *
   * Exact-in already carved it out before quoting. Exact-out adds it on top of
   * the input the route settled on, so it can only be sized now — the trade is
   * what says how much input the pinned output costs.
   */
  const swapFee = useMemo((): SwapFee => {
    if (isExactIn) {
      return inputSideFee ?? noSwapFee(0n);
    }

    const tradeInput = toggledTrade?.inputAmount;
    if (!tradeInput) return noSwapFee(0n);

    return computeSwapFee({
      amount: BigInt(tradeInput.quotient.toString()),
      rate: swapFeeRate,
      basis: SwapFeeBasis.AddedToInput,
    });
  }, [isExactIn, inputSideFee, toggledTrade, swapFeeRate]);

  const [balanceIn, amountIn] = [
    currencyBalances[SwapField.INPUT],
    toggledTrade?.maximumAmountIn(allowedSlippage),
  ];

  // The fee leaves the same wallet in the same batch, so the balance has to
  // cover it too. On exact-in it is already inside the typed amount and adds
  // nothing here; on exact-out it is genuinely extra, and a check that ignored
  // it would let a batch through that reverts on the transfer.
  const requiredIn = useMemo(() => {
    if (!amountIn) return undefined;
    const routeInput = BigInt(amountIn.quotient.toString());
    return swapFee.basis === SwapFeeBasis.AddedToInput
      ? routeInput + swapFee.feeAmount
      : routeInput;
  }, [amountIn, swapFee]);

  inputError =
    inputError ??
    getSwapFundingError({
      balance: balanceIn ? BigInt(balanceIn.quotient.toString()) : undefined,
      requiredInput: requiredIn,
      hasAmount: !!parsedAmount?.greaterThan('0'),
      symbol: inputCurrency?.symbol ?? 'funds',
    });

  const isWrap =
    currencies.INPUT &&
    currencies.OUTPUT &&
    currencies.INPUT.wrapped.equals(currencies.OUTPUT.wrapped);

  const poolAddress = isWrap
    ? undefined
    : currencies[SwapField.INPUT] &&
      currencies[SwapField.OUTPUT] &&
      (computePoolAddress({
        tokenA: currencies[SwapField.INPUT]!.wrapped,
        tokenB: currencies[SwapField.OUTPUT]!.wrapped,
      }).toLowerCase() as Address);
  const { data: globalState } = useReadAlgebraPoolGlobalState({
    address: poolAddress,
    chainId: fuse.id,
    query: {
      enabled: Boolean(poolAddress),
    },
  });

  const { data: tickSpacing } = useReadAlgebraPoolTickSpacing({
    address: poolAddress,
    chainId: fuse.id,
    query: {
      enabled: Boolean(poolAddress),
    },
  });

  return {
    currencies,
    currencyBalances,
    parsedAmount,
    inputError,
    tradeState: currentTrade,
    toggledTrade,
    tickAfterSwap,
    allowedSlippage,
    poolFee: globalState && globalState[2],
    tick: globalState && globalState[1],
    tickSpacing: tickSpacing,
    poolAddress,
    swapFee,
    revenueWalletAddress,
    refreshQuote,
  };
}
