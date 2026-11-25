import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  type Address,
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  erc20Abi,
  isAddressEqual,
} from 'viem';
import { base as baseChain, fuse } from 'viem/chains';

import { isCardSpendV2Configured, SpendCohort, toSpendMode } from '@/constants/cardSpendV2';
import {
  BASE_SPEND_DEPLOYMENT,
  isSpendDeploymentConfigured,
} from '@/constants/spendModuleDeployments';
import { useCardSpendModeAccess } from '@/hooks/useCardSpendModeAccess';
import {
  CARD_SPEND_REGISTRATION_QUERY_KEY,
  creditHeadroom,
  lensCredit,
  readBaseModeState,
} from '@/hooks/useCardSpendRegistration';
import { useCardSpendDeployments } from '@/hooks/useEuroSpendEnablement';
import useUser from '@/hooks/useUser';
import { SolidCashModuleV2_ABI } from '@/lib/abis/SolidCashModuleV2';
import { SolidSpendLens_ABI } from '@/lib/abis/SolidSpendLens';
import { ADDRESSES } from '@/lib/config';
import { publicClient } from '@/lib/wagmi';

import type { SpendMode } from '@/components/Card/NewCardDetails/SpendMode/spendModes';

/** The lens's `v2()`, which the app's lens ABI leaves out. */
const LENS_MODULE_ABI = [
  {
    type: 'function',
    name: 'v2',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

/** Collateral denominated in euros, shown in euros first: soEUR, and EURC on Base. */
const EURO_COLLATERAL_SYMBOLS: readonly string[] = ['soEUR', 'EURC'];
/** What a euro collateral is converted through: the same instance's own EURC price. */
const EURC_SYMBOL = 'EURC';

/** One asset that backs the credit line on one instance. */
export interface CreditCollateralAsset {
  chainId: number;
  token: Address;
  symbol: string;
  /** Everything the Safe holds of it, escrowed and loose together, in token units. */
  amount: bigint;
  /** 6-decimal USD at the module's own price. Zero when the price is unusable. */
  valueUsd: bigint;
  /** 6-decimal EUR, for a euro asset on an instance that prices EURC. */
  valueEur?: bigint;
  priceUsable: boolean;
  /** The module's own LTV for this token, as a WAD: `0.6e18` is 60%. */
  ltvWad: bigint;
  /** Locked against this instance's loan (`collateralOf`), in token units. */
  escrowed: bigint;
  /** In the Safe and not locked, in token units. */
  loose: bigint;
  decimals: number;
  /** The module's own price, 6-decimal USD. Zero when it cannot price the token. */
  priceUsd: bigint;
  /**
   * Inside the module's price band. Every path that divides by a price — repaying from it,
   * selling it in a liquidation — refuses a price outside the band, and a position holding any
   * such token cannot be liquidated at all.
   */
  priceInBand: boolean;
  /** {@link escrowed} at {@link priceUsd}, rounded down. */
  escrowedValueUsd: bigint;
  /** The liquidation threshold, as a WAD: the "sold at" line. */
  ltWad: bigint;
  /** What a liquidation takes on top of the debt it covers, out of this token. */
  liquidationBonusBps: number;
  /**
   * Whether the module lends against it. A token taken off the collateral list, or paused by the
   * guardian, still counts toward what a liquidation could take, but not toward borrowing power.
   */
  countsTowardPower: boolean;
  /**
   * On the module's collateral list (`TokenConfig.collateral`). False for a token taken off it
   * that is still locked: it backs the loan until unlocked, but nothing new can be locked in it.
   */
  listedAsCollateral: boolean;
  /** Fee on repaying from this token's escrow, on top of the debt retired. Zero unless set. */
  repayFeeBps: number;
}

/** The module parameters that decide when, and how much of, a loan can be sold. */
export interface CreditRiskParams {
  /** Seconds between a loan going under 1.0 and a sale being allowed. */
  liquidationGracePeriod: number;
  /** Below this health, no waiting at all — unless the loan carries a forced charge. WAD. */
  graceFloorHfWad: bigint;
  /** Most of the debt one sale can cover, in bps. */
  closeFactorBps: number;
  /** A loan at or under this (6-decimal USD) can be covered in full by one sale. */
  minPositionUsd: bigint;
  /** Seconds an unlock waits before it can be finished. */
  collateralWithdrawDelay: number;
}

/** An unlock that has been asked for and not yet finished or cancelled. */
export interface PendingCollateralUnlock {
  token: Address;
  /** Token units. */
  amount: bigint;
  /** Unix seconds from which it can be finished. */
  readyAt: number;
}

/** One spend-module instance's credit position, from its lens. */
export interface CreditInstancePosition {
  chainId: number;
  /** The module the position lives on: what a repayment on this instance is sent to. */
  moduleAddress: Address;
  debtUsd: bigint;
  /** `healthFactor(safe)` on this instance's module. `2^256-1` with no debt. */
  healthFactorWad: bigint;
  /** False when some escrowed collateral here cannot be priced. */
  fullyPriced: boolean;
  /** Escrowed power plus what the loose balance would add: the whole line, drawn or not. */
  creditLineUsd: bigint;
  /** What the line leaves to draw, as `useCardSpendRegistration` computes it for Fuse. */
  creditHeadroomUsd: bigint;
  /** Credit the lens allows for a purchase, including the card's spending limits. */
  availableToBorrowUsd: bigint;
  borrowApyPerSecond: bigint;
  /**
   * Every token the module accepts as collateral, held or not, and any other token still
   * escrowed here (one taken off the collateral list after it was locked).
   */
  collateral: CreditCollateralAsset[];
  /** When the loan was first seen under 1.0, unix seconds; 0 when it has not been. */
  unhealthySince: number;
  /** Debt from charges Wirex made regardless of our answer. Such a loan always gets the full wait. */
  forcedDebtUsd: bigint;
  pendingUnlock: PendingCollateralUnlock | null;
  /** The guardian's switch: nothing can be sold while it is on. */
  liquidationsPaused: boolean;
  params: CreditRiskParams;
}

export interface CardCreditPositions {
  fuse: CreditInstancePosition | null;
  base: CreditInstancePosition | null;
}

export type CollateralCatalogAsset = Pick<
  CreditCollateralAsset,
  'chainId' | 'token' | 'symbol' | 'ltvWad'
>;

export interface BaseCollateralPreview {
  moduleAddress: Address;
  canEnable: boolean;
}

type TokenAvailability = {
  token: Address;
  amount: bigint;
  priceUsd: bigint;
  priceUsable: boolean;
};

const valueAt = (amount: bigint, priceUsd: bigint, decimals: number): bigint =>
  (amount * priceUsd) / 10n ** BigInt(decimals);

/** Reads per token in the details multicall, in the order {@link readCreditInstance} unpacks. */
const PER_TOKEN_CALLS = 5;

/**
 * Throws the first multicall failure the chain did not answer — an RPC error or a timeout, as
 * opposed to a revert or no contract at the address.
 *
 * With `allowFailure`, viem reports a failed RPC chunk as a `failure` per call, the same shape as
 * a revert. Read as "no position", that cached a dropped read as a Safe with no line on Base and
 * kept it until the query went stale.
 *
 * A failed chunk carries the `aggregate3` call's error, never the call's own. It is unanswered
 * whatever it wraps: viem reads a node's internal error (-32603) as a revert.
 */
const throwUnansweredFailure = (
  results: readonly { status: 'success' | 'failure'; error?: Error }[],
) => {
  const unanswered = results.find(
    entry =>
      entry.status === 'failure' &&
      !(
        entry.error instanceof BaseError &&
        !(
          entry.error instanceof ContractFunctionExecutionError &&
          entry.error.functionName === 'aggregate3'
        ) &&
        entry.error.walk(
          cause =>
            cause instanceof ContractFunctionRevertedError ||
            cause instanceof ContractFunctionZeroDataError,
        )
      ),
  );
  if (unanswered) throw unanswered.error;
};

/** Collateral the Base module accepts, independent of any Safe's activation or balances. */
const readBaseCollateralCatalog = async (
  moduleAddress: Address,
): Promise<CollateralCatalogAsset[]> => {
  const chainId = baseChain.id;
  const client = publicClient(chainId);
  const module = { address: moduleAddress, abi: SolidCashModuleV2_ABI } as const;
  const blockNumber = await client.getBlockNumber();
  const tokens = await client.readContract({
    ...module,
    functionName: 'allowedTokens',
    blockNumber,
  });
  if (!tokens.length) return [];
  const results = await client.multicall({
    allowFailure: true,
    blockNumber,
    contracts: tokens.flatMap(token => [
      { ...module, functionName: 'getTokenConfig', args: [token] } as const,
      { address: token, abi: erc20Abi, functionName: 'symbol' } as const,
      { ...module, functionName: 'tokenPaused', args: [token] } as const,
    ]),
  });
  throwUnansweredFailure(results);

  return tokens.flatMap((token, index) => {
    const [config, symbol, paused] = results.slice(index * 3, index * 3 + 3);
    const terms = config?.result;
    if (
      !terms ||
      typeof terms !== 'object' ||
      !terms.collateral ||
      terms.ltv <= 0n ||
      typeof symbol?.result !== 'string' ||
      !symbol.result ||
      paused?.result !== false
    ) {
      return [];
    }
    return [{ chainId, token, symbol: symbol.result, ltvWad: terms.ltv }];
  });
};

export const useBaseCollateralCatalog = (moduleAddress: Address | undefined) =>
  useQuery({
    queryKey: ['base-collateral-catalog', moduleAddress],
    queryFn: () => readBaseCollateralCatalog(moduleAddress!),
    enabled: !!moduleAddress,
    staleTime: 5 * 60_000,
    retry: 1,
  });

/**
 * One instance's credit position, or null when the Safe has none there.
 *
 * Null covers every way an instance can have nothing to say: a Safe not operated by v2 there
 * (the Base lens reverts outright for a Safe it has not registered), and a lens paired with some
 * other module than the one the backend names. A read the chain never answered throws instead,
 * so the query retries it rather than caching it as a Safe with no line.
 *
 * The lens is read with the whole allowlist, so `debit.perToken` (loose balances) and
 * `credit.perCollateral` (escrowed) both cover every token; which of them count as collateral
 * comes from the module's own token config.
 */
export const readCreditInstance = async (
  chainId: number,
  moduleAddress: Address,
  lensAddress: Address,
  safeAddress: Address,
): Promise<CreditInstancePosition | null> => {
  const client = publicClient(chainId);
  const module = { address: moduleAddress, abi: SolidCashModuleV2_ABI } as const;
  // One block for both multicalls, so balances and health never pair with a later block's prices.
  // Uncached: the client would otherwise hand back a block number up to a polling interval old.
  const blockNumber = await client.getBlockNumber({ cacheTime: 0 });

  const [
    pairedModule,
    availability,
    params,
    totalDebtUsd,
    borrowApyPerSecond,
    healthFactor,
    unhealthySince,
    forcedDebtUsd,
    pendingWithdrawal,
    liquidationsPaused,
  ] = await client.multicall({
    allowFailure: true,
    blockNumber,
    contracts: [
      { address: lensAddress, abi: LENS_MODULE_ABI, functionName: 'v2' },
      {
        address: lensAddress,
        abi: SolidSpendLens_ABI,
        functionName: 'availableToSpend',
        args: [safeAddress],
      },
      { ...module, functionName: 'getParams' },
      { ...module, functionName: 'totalDebtUsd' },
      { ...module, functionName: 'borrowApyPerSecond' },
      { ...module, functionName: 'healthFactor', args: [safeAddress] },
      { ...module, functionName: 'unhealthySince', args: [safeAddress] },
      { ...module, functionName: 'forcedDebtUsd', args: [safeAddress] },
      { ...module, functionName: 'getPendingWithdrawal', args: [safeAddress] },
      { ...module, functionName: 'liquidationsPaused' },
    ],
  });
  throwUnansweredFailure([
    pairedModule,
    availability,
    params,
    totalDebtUsd,
    borrowApyPerSecond,
    healthFactor,
    unhealthySince,
    forcedDebtUsd,
    pendingWithdrawal,
    liquidationsPaused,
  ]);

  if (
    pairedModule.status !== 'success' ||
    params.status !== 'success' ||
    totalDebtUsd.status !== 'success' ||
    borrowApyPerSecond.status !== 'success' ||
    healthFactor.status !== 'success' ||
    !isAddressEqual(pairedModule.result, moduleAddress)
  ) {
    return null;
  }

  const lens = availability.status === 'success' ? availability.result : undefined;
  const credit = lensCredit(availability);
  if (!lens || !credit || Number(lens.cohort) !== SpendCohort.V2) return null;

  const loose = lens.debit.perToken as readonly TokenAvailability[];
  const escrowed = lens.credit.perCollateral as readonly TokenAvailability[];
  const tokens = escrowed.map(entry => entry.token);

  const details = await client.multicall({
    allowFailure: true,
    blockNumber,
    contracts: tokens.flatMap(token => [
      { ...module, functionName: 'getTokenConfig', args: [token] } as const,
      { address: token, abi: erc20Abi, functionName: 'symbol' } as const,
      { ...module, functionName: 'getPriceUsd', args: [token] } as const,
      { ...module, functionName: 'tokenPaused', args: [token] } as const,
      { ...module, functionName: 'collateralRepayFeeBps', args: [token] } as const,
    ]),
  });
  throwUnansweredFailure(details);

  const read = <T>(tokenIndex: number, call: number): T | undefined => {
    const result = details[tokenIndex * PER_TOKEN_CALLS + call];
    return result?.status === 'success' ? (result.result as T) : undefined;
  };

  const symbolOf = (token: Address): string | undefined => {
    const index = tokens.findIndex(candidate => isAddressEqual(candidate, token));
    return index >= 0 ? read<string>(index, 1) : undefined;
  };

  const eurc = loose.find(entry => symbolOf(entry.token) === EURC_SYMBOL);
  const eurcPriceUsd = eurc?.priceUsable && eurc.priceUsd > 0n ? eurc.priceUsd : undefined;

  const collateral = escrowed.flatMap((entry, index): CreditCollateralAsset[] => {
    const config = read<{
      collateral: boolean;
      tokenDecimals: number;
      liquidationBonusBps: number;
      ltv: bigint;
      liquidationThreshold: bigint;
    }>(index, 0);
    // A token whose config cannot be read cannot be shown as collateral or as not: left out.
    if (!config) return [];
    // Listed when the module lends against it, and also when it is still locked here after
    // being taken off the list: it still backs the loan, and a sale can still take it.
    if (!config.collateral && entry.amount === 0n) return [];

    const symbol = symbolOf(entry.token) ?? '';
    const decimals = config.tokenDecimals;
    const looseAmount =
      loose.find(candidate => isAddressEqual(candidate.token, entry.token))?.amount ?? 0n;
    const amount = entry.amount + looseAmount;

    // The module's own accessor says whether the price is inside its band, which the lens
    // does not. Falls back to the lens when the call is missing.
    const priced = read<readonly [bigint, boolean, boolean]>(index, 2);
    const priceUsable = priced ? priced[1] && priced[0] > 0n : entry.priceUsable;
    const priceUsd = priceUsable ? (priced ? priced[0] : entry.priceUsd) : 0n;
    // Only the module knows its band; without its answer the price is treated as out of it.
    const priceInBand = priced ? priced[2] && priceUsable : false;
    const paused = read<boolean>(index, 3) ?? false;
    const valueUsd = priceUsable ? valueAt(amount, priceUsd, decimals) : 0n;

    return [
      {
        chainId,
        token: entry.token,
        symbol,
        amount,
        valueUsd,
        valueEur:
          EURO_COLLATERAL_SYMBOLS.includes(symbol) && priceUsable && eurcPriceUsd
            ? (valueUsd * 1_000_000n) / eurcPriceUsd
            : undefined,
        priceUsable,
        ltvWad: config.ltv,
        escrowed: entry.amount,
        loose: looseAmount,
        decimals,
        priceUsd,
        priceInBand,
        escrowedValueUsd: priceUsable ? valueAt(entry.amount, priceUsd, decimals) : 0n,
        ltWad: config.liquidationThreshold,
        liquidationBonusBps: Number(config.liquidationBonusBps),
        countsTowardPower: config.collateral && !paused,
        listedAsCollateral: config.collateral,
        // The module charges the stored fee capped at the current bonus (`_sizeCollateralRepay`):
        // a bonus lowered after the fee was set lowers the fee with it.
        repayFeeBps: Math.min(
          Number(read<number>(index, 4) ?? 0),
          Number(config.liquidationBonusBps),
        ),
      },
    ];
  });

  const moduleParams = params.result as {
    maxDebtPerSafeUsd: bigint;
    maxGlobalDebtUsd: bigint;
    minPositionUsd: bigint;
    closeFactorBps: number;
    collateralWithdrawDelay: bigint;
    liquidationGracePeriod: bigint;
    graceFloorHf: bigint;
  };
  const pending =
    pendingWithdrawal.status === 'success'
      ? (pendingWithdrawal.result as { token: Address; readyAt: bigint; amount: bigint })
      : undefined;
  const canSpendOnCredit =
    lens.moduleEnabled &&
    lens.registered &&
    !lens.modulePaused &&
    !lens.safePausedFlag &&
    toSpendMode(lens.activeMode) !== 'cash' &&
    credit.fullyPriced;

  return {
    chainId,
    moduleAddress,
    debtUsd: credit.debtUsd,
    healthFactorWad: healthFactor.result as bigint,
    fullyPriced: credit.fullyPriced,
    creditLineUsd: credit.borrowingPowerUsd + credit.prospectiveCollateralUsd,
    creditHeadroomUsd: creditHeadroom(credit, moduleParams, totalDebtUsd.result as bigint),
    availableToBorrowUsd: canSpendOnCredit ? credit.availableToBorrowUsd : 0n,
    borrowApyPerSecond: borrowApyPerSecond.result as bigint,
    collateral,
    unhealthySince: unhealthySince.status === 'success' ? Number(unhealthySince.result) : 0,
    forcedDebtUsd: forcedDebtUsd.status === 'success' ? (forcedDebtUsd.result as bigint) : 0n,
    // `readyAt` is zero when nothing is armed; the module's own test for "none".
    pendingUnlock:
      pending && pending.readyAt > 0n
        ? { token: pending.token, amount: pending.amount, readyAt: Number(pending.readyAt) }
        : null,
    liquidationsPaused:
      liquidationsPaused.status === 'success' ? (liquidationsPaused.result as boolean) : false,
    params: {
      liquidationGracePeriod: Number(moduleParams.liquidationGracePeriod),
      graceFloorHfWad: moduleParams.graceFloorHf,
      closeFactorBps: Number(moduleParams.closeFactorBps),
      minPositionUsd: moduleParams.minPositionUsd,
      collateralWithdrawDelay: Number(moduleParams.collateralWithdrawDelay),
    },
  };
};

/**
 * The cardholder's credit position on each instance the card can borrow on: Fuse, and Base for
 * the spend-mode cohort once they have enabled euro spending — the same Safes a mode switch is
 * carried over to.
 *
 * Read only while `enabled`, which the spend-mode sheet sets while it is open: this is one more
 * lens read per instance, and nothing else on screen needs the per-asset breakdown.
 *
 * Keyed under the registration query, so every write that refreshes the card's spend state —
 * a mode switch, a repay — refreshes this too.
 */
/**
 * The Base instance the card borrows on for this cardholder, when it does.
 *
 * The spend-mode cohort once they have enabled euro spending: the same Safes a mode switch is
 * carried over to. The backend's Base module wins over the build's, as everywhere else; the lens
 * comes from the build and is checked against it before anything it says is used. Shared with the
 * repay flow, so a Base repayment goes to exactly the module the position was read from.
 */
export const useBaseCreditInstance = () => {
  const {
    isEnabled: isSpendModeCohort,
    isLoading: isAccessLoading,
    isError: isAccessError,
    refetch: refetchAccess,
  } = useCardSpendModeAccess();
  const {
    data: spendDeployments,
    isLoading: isDeploymentsLoading,
    isError: isDeploymentsError,
    refetch: refetchDeployments,
  } = useCardSpendDeployments();
  const baseDeployment = spendDeployments?.deployments.find(
    deployment => deployment.chainId === baseChain.id,
  );
  const moduleAddress = (baseDeployment?.moduleAddress ?? BASE_SPEND_DEPLOYMENT.moduleAddress) as
    | Address
    | undefined;
  const lensAddress = BASE_SPEND_DEPLOYMENT.spendLensAddress as Address | undefined;
  const isLive =
    isSpendModeCohort && baseDeployment?.enabled === true && !!moduleAddress && !!lensAddress;
  const collateralPreview = useMemo<BaseCollateralPreview | undefined>(
    () =>
      !isLive &&
      isSpendModeCohort &&
      spendDeployments?.cohortEnabled &&
      baseDeployment?.available &&
      baseDeployment.moduleAddress
        ? {
            moduleAddress: baseDeployment.moduleAddress as Address,
            canEnable:
              !baseDeployment.enabled && isSpendDeploymentConfigured(BASE_SPEND_DEPLOYMENT),
          }
        : undefined,
    [isLive, isSpendModeCohort, spendDeployments?.cohortEnabled, baseDeployment],
  );

  // `isLive` reads false until both gates answer; this says whether that false is final yet.
  // A gate that failed leaves it false too, which is not a Safe with no Base loan.
  const isError = isAccessError || (isSpendModeCohort && isDeploymentsError);
  return {
    isLive,
    collateralPreview,
    isLoading: isAccessLoading || isDeploymentsLoading,
    isError,
    /** Retries whichever gate failed. */
    refetchGate: () =>
      Promise.all([
        isAccessError ? refetchAccess() : undefined,
        isDeploymentsError ? refetchDeployments() : undefined,
      ]),
    moduleAddress,
    lensAddress,
  };
};

/**
 * The mode the Base instance holds for this Safe, or null when Base is not part of this card
 * (not enabled there, not registered, or not answered yet).
 *
 * The picker takes the card's mode from Fuse, so a switch that reached Fuse and not Base looks
 * finished: choosing the same mode again only closed the sheet. That is where every Credit switch
 * made outside the spend-mode cohort ended up while Base was held back for it (45 Safes on
 * Nov 26 2026, at a €0 credit line against Base balances), and where a Base step that failed
 * leaves a Safe. This is what lets the sheet see Base is behind and offer to finish the change.
 *
 * Keyed under the registration query, so a switch refreshes it with everything else.
 *
 * `mode` is null both when Base is confirmed not to be part of the card and while that is not
 * known yet, so `isLoading` and `isError` say which: the sheet must not read an unanswered Base as
 * one that matches, or the cardholder this exists for is offered "Cancel" again. Either one covers
 * the Base gate as well as the mode read, since a gate that has not answered reads as "no Base".
 * A mode already read wins over a refetch that is loading or failed.
 */
export const useBaseSpendMode = ({
  enabled,
}: {
  enabled: boolean;
}): {
  mode: SpendMode | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
} => {
  const { user } = useUser();
  const safeAddress = user?.safeAddress as Address | undefined;
  const {
    isLive,
    moduleAddress,
    isLoading: isGateLoading,
    isError: isGateError,
    refetchGate,
  } = useBaseCreditInstance();
  const canRead = isLive && !!safeAddress && !!moduleAddress;

  const query = useQuery({
    queryKey: [CARD_SPEND_REGISTRATION_QUERY_KEY, 'base-mode', safeAddress, moduleAddress],
    queryFn: () => readBaseModeState(safeAddress as Address, moduleAddress as Address),
    enabled: enabled && canRead,
  });
  const hasAnswer = canRead && query.data !== undefined;

  return {
    mode: hasAnswer && query.data?.live ? query.data.mode : null,
    isLoading: enabled && !hasAnswer && (isGateLoading || (canRead && query.isLoading)),
    isError: enabled && !hasAnswer && (isGateError || (canRead && query.isError)),
    // Only what failed: a manual refetch ignores `enabled` and would read without an address.
    refetch: () =>
      isGateError ? refetchGate() : canRead ? query.refetch() : Promise.resolve(undefined),
  };
};

/**
 * One query per instance, so a read that fails on one chain never discards the other's answer.
 */
export const creditInstanceQuery = (
  chainId: number,
  moduleAddress: Address | undefined,
  lensAddress: Address | undefined,
  safeAddress: Address | undefined,
  enabled: boolean,
  refetchInterval?: number,
) => ({
  queryKey: [
    CARD_SPEND_REGISTRATION_QUERY_KEY,
    'credit-positions',
    chainId,
    safeAddress,
    moduleAddress,
  ],
  queryFn: () => readCreditInstance(chainId, moduleAddress!, lensAddress!, safeAddress!),
  enabled: enabled && !!safeAddress && !!moduleAddress && !!lensAddress,
  // Only reads the chain never answered get here; a Safe with no position resolves to null.
  retry: 2,
  staleTime: 15_000,
  refetchInterval,
});

/**
 * Where each instance's position is read from, for code that has to read it again itself — an
 * unlock re-quotes against a fresh read right before it is signed.
 */
export const useCreditInstanceAddresses = () => {
  const base = useBaseCreditInstance();
  return {
    [fuse.id]: {
      live: isCardSpendV2Configured(),
      moduleAddress: ADDRESSES.fuse.cashModuleV2 as Address,
      lensAddress: ADDRESSES.fuse.spendLensV2 as Address,
    },
    [baseChain.id]: {
      live: base.isLive,
      moduleAddress: base.moduleAddress,
      lensAddress: base.lensAddress,
    },
  } as Record<number, { live: boolean; moduleAddress?: Address; lensAddress?: Address }>;
};

export const useCardCreditPositions = ({
  enabled,
  refetchInterval,
}: {
  enabled: boolean;
  /** Re-read while a screen shows a countdown or a pending unlock. */
  refetchInterval?: number;
}) => {
  const { user } = useUser();
  const safeAddress = user?.safeAddress as Address | undefined;

  const {
    isLive: readsBase,
    collateralPreview: baseCollateralPreview,
    isLoading: isBaseGateLoading,
    isError: isBaseGateError,
    refetchGate: refetchBaseGate,
    moduleAddress: baseModule,
    lensAddress: baseLens,
  } = useBaseCreditInstance();
  const readsFuse = isCardSpendV2Configured();

  const fuseQuery = useQuery(
    creditInstanceQuery(
      fuse.id,
      ADDRESSES.fuse.cashModuleV2,
      ADDRESSES.fuse.spendLensV2,
      safeAddress,
      enabled && readsFuse,
      refetchInterval,
    ),
  );
  const baseQuery = useQuery(
    creditInstanceQuery(
      baseChain.id,
      baseModule,
      baseLens,
      safeAddress,
      enabled && readsBase,
      refetchInterval,
    ),
  );

  const data = useMemo<CardCreditPositions>(
    () => ({
      fuse: readsFuse ? (fuseQuery.data ?? null) : null,
      base: readsBase ? (baseQuery.data ?? null) : null,
    }),
    [readsFuse, readsBase, fuseQuery.data, baseQuery.data],
  );

  return {
    data,
    fuse: fuseQuery,
    base: baseQuery,
    baseCollateralPreview,
    readsBase,
    isBaseGateReady: !isBaseGateLoading && !isBaseGateError,
    /** Some instance this cardholder borrows on has not answered its first read yet. */
    // Base's gate counts too: until it answers, a Base-only borrower would read as owing nothing.
    isLoading:
      (readsFuse && fuseQuery.isLoading) || isBaseGateLoading || (readsBase && baseQuery.isLoading),
    /**
     * Some instance's read failed, so a loan there may be missing from `data` — including the Base
     * gate, which otherwise reads as "no Base loan".
     */
    isError:
      (readsFuse && fuseQuery.isError) || isBaseGateError || (readsBase && baseQuery.isError),
    // Only queries that can run: a manual refetch ignores `enabled` and would read without a lens.
    refetch: () =>
      Promise.all([
        readsFuse && safeAddress ? fuseQuery.refetch() : undefined,
        isBaseGateError ? refetchBaseGate() : undefined,
        readsBase && safeAddress && baseModule && baseLens ? baseQuery.refetch() : undefined,
      ]),
  };
};

export default useCardCreditPositions;
