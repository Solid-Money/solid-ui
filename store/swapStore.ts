import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { soUSDC_TOKEN, USDC_STARGATE_TOKEN } from '@/constants/tokens';
import { useReadAlgebraPoolGlobalState, useReadAlgebraPoolTickSpacing } from '@/generated/wagmi';
import { useBestTradeExactIn, useBestTradeExactOut } from '@/hooks/swap/useBestTrade';
import useSwapSlippageTolerance from '@/hooks/swap/useSwapSlippageTolerance';
import { useVoltageRouter, VoltageTrade } from '@/hooks/swap/useVoltageRouter';
import { useCurrency } from '@/hooks/tokens/useCurrency';
import { useSwapFeeRate } from '@/hooks/useProductFees';
import useUser from '@/hooks/useUser';
import { SwapModal, TransactionStatusModal } from '@/lib/types';
import { SwapField, SwapFieldType } from '@/lib/types/swap-field';
import { TradeState, TradeStateType } from '@/lib/types/trade-state';
import { computeSwapFee, noSwapFee, SwapFee, SwapFeeBasis } from '@/lib/utils/swapFee';

interface SwapState {
  readonly independentField: SwapFieldType;
  readonly typedValue: string;
  readonly [SwapField.INPUT]: {
    readonly currencyId: Address | undefined;
  };
  readonly [SwapField.OUTPUT]: {
    readonly currencyId: Address | undefined;
  };
  readonly wasInverted: boolean;
  readonly lastFocusedField: SwapFieldType;
  readonly currentModal: SwapModal;
  readonly previousModal: SwapModal;
  readonly transaction: TransactionStatusModal & {
    inputCurrencySymbol?: string;
    outputCurrencySymbol?: string;
    transactionHash?: string;
    chainId?: number;
  };
  actions: {
    selectCurrency: (field: SwapFieldType, currencyId: string | undefined) => void;
    switchCurrencies: () => void;
    typeInput: (field: SwapFieldType, typedValue: string) => void;
    resetForm: () => void;
    setModal: (modal: SwapModal) => void;
    setTransaction: (transaction: SwapState['transaction']) => void;
  };
}

export const useSwapState = create<SwapState>((set, get) => ({
  independentField: SwapField.INPUT,
  typedValue: '',
  [SwapField.INPUT]: {
    currencyId: USDC_STARGATE_TOKEN.address as Address, // TOOD: DEFAULT TOKEN, change it to load from localStorage
  },
  [SwapField.OUTPUT]: {
    currencyId: soUSDC_TOKEN.address as Address,
  },
  wasInverted: false,
  lastFocusedField: SwapField.INPUT,
  currentModal: SWAP_MODAL.CLOSE,
  previousModal: SWAP_MODAL.CLOSE,
  transaction: {},
  actions: {
    selectCurrency: (field, currencyId) => {
      const otherField = field === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT;

      if (currencyId && currencyId === get()[otherField].currencyId) {
        set({
          independentField:
            get().independentField === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT,
          lastFocusedField:
            get().independentField === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT,
          [field]: { currencyId },
          [otherField]: { currencyId: get()[field].currencyId },
        });
      } else {
        set({
          [field]: { currencyId },
        });
      }
    },
    switchCurrencies: () =>
      set({
        independentField:
          get().independentField === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT,
        lastFocusedField:
          get().independentField === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT,
        [SwapField.INPUT]: {
          currencyId: get()[SwapField.OUTPUT].currencyId,
        },
        [SwapField.OUTPUT]: {
          currencyId: get()[SwapField.INPUT].currencyId,
        },
      }),
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
      }),
    setTransaction: transaction => set({ transaction }),
  },
}));

export function useSwapActionHandlers(): {
  onCurrencySelection: (field: SwapFieldType, currency: Currency) => void;
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
    onUserInput,
  };
}

/**
 * Hook to derive swap information for a given swap state.
 *
 * @returns An object containing the following properties:
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
export function useDerivedSwapInfo(): {
  currencies: { [field in SwapFieldType]?: Currency };
  currencyBalances: { [field in SwapFieldType]?: CurrencyAmount<Currency> };
  parsedAmount: CurrencyAmount<Currency> | undefined;
  inputError?: string;
  tradeState: {
    trade: Trade<Currency, Currency, TradeType> | null;
    state: TradeStateType;
    fee?: bigint[] | null;
  };
  toggledTrade: Trade<Currency, Currency, TradeType> | undefined;
  voltageTrade: { trade: VoltageTrade | undefined; isLoading: boolean };
  isVoltageTrade: boolean;
  isVoltageTradeLoading: boolean;
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
} {
  const { user } = useUser();
  const account = user?.safeAddress;
  const [isVoltageTrade, setIsVoltageTrade] = useState(false);
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

  const isExactIn: boolean = independentField === SwapField.INPUT;
  const parsedAmount = useMemo(
    () => tryParseAmount(typedValue, (isExactIn ? inputCurrency : outputCurrency) ?? undefined),
    [typedValue, isExactIn, inputCurrency, outputCurrency],
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
    if (!isExactIn || !parsedAmount) return undefined;
    return computeSwapFee({
      amount: BigInt(parsedAmount.quotient.toString()),
      rate: swapFeeRate,
      basis: SwapFeeBasis.DeductedFromInput,
    });
  }, [isExactIn, parsedAmount, swapFeeRate]);

  /** What the routers quote: the net amount on exact-in, the target on exact-out. */
  const amountToRoute = useMemo(() => {
    if (!parsedAmount) return undefined;
    if (!inputSideFee || inputSideFee.feeAmount <= 0n) return parsedAmount;
    return CurrencyAmount.fromRawAmount(parsedAmount.currency, inputSideFee.swapAmount.toString());
  }, [parsedAmount, inputSideFee]);

  const bestTradeExactIn = useBestTradeExactIn(
    isExactIn ? amountToRoute : undefined,
    outputCurrency ?? undefined,
  );
  const bestTradeExactOut = useBestTradeExactOut(
    inputCurrency ?? undefined,
    !isExactIn ? amountToRoute : undefined,
  );

  const currentTrade = useMemo(
    () => (isExactIn ? bestTradeExactIn : bestTradeExactOut),
    [isExactIn, bestTradeExactIn, bestTradeExactOut],
  );

  const slippage = useSwapSlippageTolerance().divide(100);
  const voltageTrade = useVoltageRouter(
    inputCurrency,
    outputCurrency,
    amountToRoute,
    isExactIn,
    slippage.toFixed(),
  );

  console.log('voltageTrade', voltageTrade);

  // Track if component has mounted to avoid state updates during hydration
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    // Skip state updates until after initial mount/hydration
    if (!hasMounted) return;
    if (voltageTrade.isLoading) return;

    // Use setTimeout to avoid setState during render
    const timeoutId = setTimeout(() => {
      if (currentTrade.state === TradeState.NO_ROUTE_FOUND) {
        setIsVoltageTrade(false);
      } else if (voltageTrade.isValid) {
        if (
          isExactIn &&
          currentTrade?.trade?.outputAmount &&
          voltageTrade.trade?.outputAmount &&
          currentTrade.trade.outputAmount.lessThan(voltageTrade.trade.outputAmount)
        ) {
          setIsVoltageTrade(true);
        } else if (
          !isExactIn &&
          currentTrade?.trade?.inputAmount &&
          voltageTrade.trade?.inputAmount &&
          currentTrade.trade.inputAmount.lessThan(voltageTrade.trade.inputAmount)
        ) {
          setIsVoltageTrade(true);
        } else {
          setIsVoltageTrade(false);
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [
    hasMounted,
    voltageTrade.isLoading,
    voltageTrade.isValid,
    voltageTrade.trade?.outputAmount,
    voltageTrade.trade?.inputAmount,
    isExactIn,
    currentTrade.state,
    currentTrade.trade?.outputAmount,
    currentTrade.trade?.inputAmount,
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

    const tradeInput = toggledTrade?.inputAmount ?? voltageTrade.trade?.inputAmount;
    if (!tradeInput) return noSwapFee(0n);

    return computeSwapFee({
      amount: BigInt(tradeInput.quotient.toString()),
      rate: swapFeeRate,
      basis: SwapFeeBasis.AddedToInput,
    });
  }, [isExactIn, inputSideFee, toggledTrade, voltageTrade.trade, swapFeeRate]);

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
    if (swapFee.basis !== SwapFeeBasis.AddedToInput || swapFee.feeAmount <= 0n) {
      return amountIn;
    }
    return amountIn.add(
      CurrencyAmount.fromRawAmount(amountIn.currency, swapFee.feeAmount.toString()),
    );
  }, [amountIn, swapFee]);

  if (balanceIn && requiredIn && balanceIn.lessThan(requiredIn)) {
    inputError = `Insufficient ${requiredIn.currency.symbol} balance`;
  }

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
    isVoltageTrade,
    isVoltageTradeLoading: voltageTrade?.isLoading || false,
    voltageTrade: isVoltageTrade ? voltageTrade : { trade: undefined, isLoading: false },
    poolFee: globalState && globalState[2],
    tick: globalState && globalState[1],
    tickSpacing: tickSpacing,
    poolAddress,
    swapFee,
    revenueWalletAddress,
  };
}
