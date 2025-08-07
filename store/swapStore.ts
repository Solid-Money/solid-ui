import { SWAP_MODAL } from '@/constants/modals';
import { VOLT_TOKEN, WFUSE_TOKEN } from '@/constants/tokens';
import { useReadAlgebraPoolGlobalState, useReadAlgebraPoolTickSpacing } from '@/generated/wagmi';
import { useBestTradeExactIn, useBestTradeExactOut } from '@/hooks/swap/useBestTrade';
import useSwapSlippageTolerance from '@/hooks/swap/useSwapSlippageTolerance';
import { useVoltageRouter, VoltageTrade } from '@/hooks/swap/useVoltageRouter';
import { useCurrency } from '@/hooks/tokens/useCurrency';
import useUser from '@/hooks/useUser';
import { SwapModal, TransactionStatusModal } from '@/lib/types';
import { SwapField, SwapFieldType } from '@/lib/types/swap-field';
import { TradeState, TradeStateType } from '@/lib/types/trade-state';
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address } from 'viem';
import { useBalance } from 'wagmi';
import { create } from 'zustand';

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
        currencyId: WFUSE_TOKEN.address as Address, // TOOD: DEFAULT TOKEN, change it to load from localStorage
    },
    [SwapField.OUTPUT]: {
        currencyId: VOLT_TOKEN.address as Address,
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
                    independentField: get().independentField === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT,
                    lastFocusedField: get().independentField === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT,
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
                independentField: get().independentField === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT,
                lastFocusedField: get().independentField === SwapField.INPUT ? SwapField.OUTPUT : SwapField.INPUT,
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
        setModal: (modal) =>
            set({
                previousModal: get().currentModal,
                currentModal: modal,
            }),
        setTransaction: (transaction) => set({ transaction }),
    },
}));

export function useSwapActionHandlers(): {
    onCurrencySelection: (field: SwapFieldType, currency: Currency) => void;
    onSwitchTokens: () => void;
    onUserInput: (field: SwapFieldType, typedValue: string) => void;
} {
    const {
        actions: { selectCurrency, switchCurrencies, typeInput },
    } = useSwapState();

    const onCurrencySelection = useCallback(
        (field: SwapFieldType, currency: Currency) =>
            selectCurrency(field, currency.isToken ? currency.address : currency.isNative ? ADDRESS_ZERO : ''),
        []
    );

    const onSwitchTokens = useCallback(() => {
        switchCurrencies();
    }, []);

    const onUserInput = useCallback((field: SwapFieldType, typedValue: string) => {
        typeInput(field, typedValue);
    }, []);

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
} {
    const { user } = useUser();
    const account = user?.safeAddress;
    // const { address: account } = useAccount();
    const [isVoltageTrade, setIsVoltageTrade] = useState(false);
    const {
        independentField,
        typedValue,
        [SwapField.INPUT]: { currencyId: inputCurrencyId },
        [SwapField.OUTPUT]: { currencyId: outputCurrencyId },
    } = useSwapState();

    const inputCurrency = useCurrency(inputCurrencyId);
    const outputCurrency = useCurrency(outputCurrencyId);

    const isExactIn: boolean = independentField === SwapField.INPUT;
    const parsedAmount = useMemo(
        () => tryParseAmount(typedValue, (isExactIn ? inputCurrency : outputCurrency) ?? undefined),
        [typedValue, isExactIn, inputCurrency, outputCurrency]
    );

    const bestTradeExactIn = useBestTradeExactIn(isExactIn ? parsedAmount : undefined, outputCurrency ?? undefined);
    const bestTradeExactOut = useBestTradeExactOut(inputCurrency ?? undefined, !isExactIn ? parsedAmount : undefined);
    const slippage = useSwapSlippageTolerance().divide(100);
    const voltageTrade = useVoltageRouter(inputCurrency, outputCurrency, parsedAmount, isExactIn, slippage.toFixed());
    const trade = isExactIn ? bestTradeExactIn : bestTradeExactOut;

    useEffect(() => {
        if (voltageTrade.isLoading) return;
        const currentTrade = isExactIn ? bestTradeExactIn : bestTradeExactOut;
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
    }, [voltageTrade, isExactIn, bestTradeExactIn, bestTradeExactOut]);

    const [addressA, addressB] = [
        inputCurrency?.isNative ? undefined : inputCurrency?.address || '',
        outputCurrency?.isNative ? undefined : outputCurrency?.address || '',
    ] as Address[];

    const { data: inputCurrencyBalance } = useBalance({
        address: account,
        token: addressA,
        query: {
            enabled: !!account && !!addressA,
        },
    });
    const { data: outputCurrencyBalance } = useBalance({
        address: account,
        token: addressB,
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

    if (!parsedAmount) {
        inputError = inputError ?? `Enter an amount`;
    }

    if (!currencies[SwapField.INPUT] || !currencies[SwapField.OUTPUT]) {
        inputError = inputError ?? `Select a token`;
    }

    const toggledTrade = trade.trade ?? undefined;

    const tickAfterSwap =
        trade.priceAfterSwap &&
        TickMath.getTickAtSqrtRatio(JSBI.BigInt(trade.priceAfterSwap[trade.priceAfterSwap.length - 1].toString()));

    const allowedSlippage = useSwapSlippageTolerance(toggledTrade);

    const [balanceIn, amountIn] = [currencyBalances[SwapField.INPUT], toggledTrade?.maximumAmountIn(allowedSlippage)];

    if (balanceIn && amountIn && balanceIn.lessThan(amountIn)) {
        inputError = `Insufficient ${amountIn.currency.symbol} balance`;
    }

    const isWrap = currencies.INPUT && currencies.OUTPUT && currencies.INPUT.wrapped.equals(currencies.OUTPUT.wrapped);

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
    });

    const { data: tickSpacing } = useReadAlgebraPoolTickSpacing({
        address: poolAddress,
    });

    return {
        currencies,
        currencyBalances,
        parsedAmount,
        inputError,
        tradeState: trade,
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
    };
}
