import { useQuery } from '@tanstack/react-query';
import { type Address, erc20Abi, isAddressEqual } from 'viem';
import { base, fuse } from 'viem/chains';

import { isCardSpendV2Configured, SpendCohort } from '@/constants/cardSpendV2';
import { BASE_SPEND_DEPLOYMENT } from '@/constants/spendModuleDeployments';
import { useCardSpendModeAccess } from '@/hooks/useCardSpendModeAccess';
import {
  CARD_SPEND_REGISTRATION_QUERY_KEY,
  creditHeadroom,
  lensCredit,
} from '@/hooks/useCardSpendRegistration';
import { useCardSpendDeployments } from '@/hooks/useEuroSpendEnablement';
import useUser from '@/hooks/useUser';
import { SolidCashModuleV2_ABI } from '@/lib/abis/SolidCashModuleV2';
import { SolidSpendLens_ABI } from '@/lib/abis/SolidSpendLens';
import { ADDRESSES } from '@/lib/config';
import { publicClient } from '@/lib/wagmi';

/**
 * `getTokenConfig` and the lens's `v2()`, which the app's ABIs leave out.
 *
 * The struct is `TokenConfig` from `SolidCashTypes.sol`, and both live instances — Fuse and the
 * older Base build — decode it in this layout. Only `collateral` and `tokenDecimals` are read.
 */
const TOKEN_CONFIG_ABI = [
  {
    type: 'function',
    name: 'getTokenConfig',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'spendable', type: 'bool' },
          { name: 'collateral', type: 'bool' },
          { name: 'tokenDecimals', type: 'uint8' },
          { name: 'haircutBps', type: 'uint16' },
          { name: 'liquidationBonusBps', type: 'uint16' },
          { name: 'ltv', type: 'uint64' },
          { name: 'liquidationThreshold', type: 'uint64' },
          { name: 'maxStalenessSeconds', type: 'uint64' },
          { name: 'minPriceUsd', type: 'uint64' },
          { name: 'maxPriceUsd', type: 'uint64' },
          { name: 'ceilingGrowthPerSec', type: 'uint64' },
          { name: 'ceilingAnchor', type: 'uint64' },
        ],
      },
    ],
  },
] as const;

const LENS_MODULE_ABI = [
  {
    type: 'function',
    name: 'v2',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

/** Collateral denominated in euros, shown in euros first. */
const EURO_COLLATERAL_SYMBOLS: readonly string[] = ['soEUR'];
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
  borrowApyPerSecond: bigint;
  /** Every token the module accepts as collateral, held or not. */
  collateral: CreditCollateralAsset[];
}

export interface CardCreditPositions {
  fuse: CreditInstancePosition | null;
  base: CreditInstancePosition | null;
}

type TokenAvailability = {
  token: Address;
  amount: bigint;
  priceUsd: bigint;
  priceUsable: boolean;
};

const valueAt = (amount: bigint, priceUsd: bigint, decimals: number): bigint =>
  (amount * priceUsd) / 10n ** BigInt(decimals);

/**
 * One instance's credit position, or null when the Safe has none there.
 *
 * Null covers every way an instance can have nothing to say: a Safe not operated by v2 there
 * (the Base lens reverts outright for a Safe it has not registered), a lens paired with some
 * other module than the one the backend names, and a read that fails. None of them is worth
 * failing the sheet over — the other instance still has a position to show.
 *
 * The lens is read with the whole allowlist, so `debit.perToken` (loose balances) and
 * `credit.perCollateral` (escrowed) both cover every token; which of them count as collateral
 * comes from the module's own token config.
 */
const readCreditInstance = async (
  chainId: number,
  moduleAddress: Address,
  lensAddress: Address,
  safeAddress: Address,
): Promise<CreditInstancePosition | null> => {
  const client = publicClient(chainId);
  const module = { address: moduleAddress, abi: SolidCashModuleV2_ABI } as const;

  const [pairedModule, availability, params, totalDebtUsd, borrowApyPerSecond, healthFactor] =
    await client.multicall({
      allowFailure: true,
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
      ],
    });

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
    contracts: tokens.flatMap(token => [
      {
        address: moduleAddress,
        abi: TOKEN_CONFIG_ABI,
        functionName: 'getTokenConfig',
        args: [token],
      } as const,
      { address: token, abi: erc20Abi, functionName: 'symbol' } as const,
    ]),
  });

  const symbolOf = (token: Address): string | undefined => {
    const index = tokens.findIndex(candidate => isAddressEqual(candidate, token));
    const result = index >= 0 ? details[index * 2 + 1] : undefined;
    return result?.status === 'success' ? (result.result as string) : undefined;
  };

  const eurc = loose.find(entry => symbolOf(entry.token) === EURC_SYMBOL);
  const eurcPriceUsd = eurc?.priceUsable && eurc.priceUsd > 0n ? eurc.priceUsd : undefined;

  const collateral = escrowed.flatMap((entry, index): CreditCollateralAsset[] => {
    const config = details[index * 2];
    // A token whose config cannot be read cannot be shown as collateral or as not: left out.
    if (config?.status !== 'success') return [];
    const { collateral: isCollateral, tokenDecimals } = config.result as {
      collateral: boolean;
      tokenDecimals: number;
    };
    if (!isCollateral) return [];

    const symbol = symbolOf(entry.token) ?? '';
    const looseAmount =
      loose.find(candidate => isAddressEqual(candidate.token, entry.token))?.amount ?? 0n;
    const amount = entry.amount + looseAmount;
    const valueUsd = entry.priceUsable ? valueAt(amount, entry.priceUsd, tokenDecimals) : 0n;

    return [
      {
        chainId,
        token: entry.token,
        symbol,
        amount,
        valueUsd,
        valueEur:
          EURO_COLLATERAL_SYMBOLS.includes(symbol) && entry.priceUsable && eurcPriceUsd
            ? (valueUsd * 1_000_000n) / eurcPriceUsd
            : undefined,
        priceUsable: entry.priceUsable,
      },
    ];
  });

  return {
    chainId,
    moduleAddress,
    debtUsd: credit.debtUsd,
    healthFactorWad: healthFactor.result as bigint,
    fullyPriced: credit.fullyPriced,
    creditLineUsd: credit.borrowingPowerUsd + credit.prospectiveCollateralUsd,
    creditHeadroomUsd: creditHeadroom(
      credit,
      params.result as { maxDebtPerSafeUsd: bigint; maxGlobalDebtUsd: bigint },
      totalDebtUsd.result as bigint,
    ),
    borrowApyPerSecond: borrowApyPerSecond.result as bigint,
    collateral,
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
  const { isEnabled: isSpendModeCohort } = useCardSpendModeAccess();
  const { data: spendDeployments } = useCardSpendDeployments();
  const baseDeployment = spendDeployments?.deployments.find(
    deployment => deployment.chainId === base.id,
  );
  const moduleAddress = (baseDeployment?.moduleAddress ?? BASE_SPEND_DEPLOYMENT.moduleAddress) as
    | Address
    | undefined;
  const lensAddress = BASE_SPEND_DEPLOYMENT.spendLensAddress as Address | undefined;
  const isLive =
    isSpendModeCohort && baseDeployment?.enabled === true && !!moduleAddress && !!lensAddress;

  return { isLive, moduleAddress, lensAddress };
};

export const useCardCreditPositions = ({ enabled }: { enabled: boolean }) => {
  const { user } = useUser();
  const safeAddress = user?.safeAddress as Address | undefined;

  const {
    isLive: readsBase,
    moduleAddress: baseModule,
    lensAddress: baseLens,
  } = useBaseCreditInstance();
  const readsFuse = isCardSpendV2Configured();

  return useQuery<CardCreditPositions>({
    queryKey: [
      CARD_SPEND_REGISTRATION_QUERY_KEY,
      'credit-positions',
      safeAddress,
      readsFuse,
      readsBase ? baseModule : null,
    ],
    queryFn: async () => {
      const [fusePosition, basePosition] = await Promise.all([
        readsFuse
          ? readCreditInstance(
              fuse.id,
              ADDRESSES.fuse.cashModuleV2,
              ADDRESSES.fuse.spendLensV2,
              safeAddress!,
            ).catch(() => null)
          : null,
        readsBase
          ? readCreditInstance(base.id, baseModule!, baseLens!, safeAddress!).catch(() => null)
          : null,
      ]);
      return { fuse: fusePosition, base: basePosition };
    },
    enabled: enabled && !!safeAddress && (readsFuse || readsBase),
    retry: false,
    staleTime: 15_000,
  });
};

export default useCardCreditPositions;
