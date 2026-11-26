import {
  Address,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  Hex,
  parseAbiParameters,
  zeroAddress,
} from 'viem';

import { USDC_STARGATE, USDT_STARGATE } from '@/constants/addresses';
import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import { ADDRESSES } from '@/lib/config';
import { isSoUsdBaseConfigured } from '@/lib/soUsdWithdraw';

/**
 * Fuse-to-Base migration: moving a Wirex cardholder's spendable balance on Fuse (USDC, USDT, soUSD,
 * soETH) to their Safe on Base, where the card now spends first.
 *
 * Two routes, both free to the user:
 * - `vault_bridge` — soUSD and soETH shares go through the Fuse BridgePaymaster's `sponsorBridge`,
 *   which pulls the approved shares and pays the LayerZero fee to the Base teller.
 * - `deposit_address` — USDC and USDT are sent to the user's WALLET direct-deposit address. The
 *   backend sweeps them, bridges them to Base and delivers to the Safe there, with no deposit fee,
 *   no minimum and the bridge paid by the backend: 10 USDC on Fuse is 10 USDC on Base (USDT can
 *   arrive as USDC where no same-token route exists).
 */

export type FuseMigrationRoute = 'vault_bridge' | 'deposit_address';

export interface FuseMigrationAsset {
  symbol: 'USDC' | 'USDT' | 'soUSD' | 'soETH';
  /** The token on Fuse. */
  token: Address;
  decimals: number;
  route: FuseMigrationRoute;
  /** The Fuse LayerZero teller the shares bridge through. Vault routes only. */
  teller?: Address;
}

export interface FuseMigrationItem extends FuseMigrationAsset {
  /** The Safe's own balance on Fuse: never collateral locked in the credit module. */
  amount: bigint;
  /** Dollar value, from the app's balance prices (stablecoins at $1). Zero when unpriced. */
  valueUsd: number;
  /** The paymaster's per-teller minimum, for a vault route. Zero otherwise. */
  minimum: bigint;
  /** False for vault shares below the paymaster minimum: they stay on Fuse. */
  movable: boolean;
}

/** Below this the Fuse balance is dust, not something to interrupt the cardholder for. */
export const MIN_FUSE_MIGRATION_USD = 1;

/** LayerZero endpoint id of Base, which both Fuse vault tellers are peered with. */
export const BASE_LZ_EID = 30184;

const isSet = (address: Address | undefined): address is Address =>
  !!address && address !== zeroAddress;

/**
 * The assets this build can migrate. A vault is left out when this build has no Base deployment
 * of it to receive the shares, since bridging them would strand them on a chain the app cannot
 * show.
 */
export const getFuseMigrationAssets = (): FuseMigrationAsset[] => {
  const assets: FuseMigrationAsset[] = [
    { symbol: 'USDC', token: USDC_STARGATE, decimals: 6, route: 'deposit_address' },
    { symbol: 'USDT', token: USDT_STARGATE, decimals: 6, route: 'deposit_address' },
  ];
  if (isSoUsdBaseConfigured && isSet(ADDRESSES.fuse.vault) && isSet(ADDRESSES.fuse.teller)) {
    assets.push({
      symbol: 'soUSD',
      token: ADDRESSES.fuse.vault,
      decimals: 6,
      route: 'vault_bridge',
      teller: ADDRESSES.fuse.teller,
    });
  }
  if (
    isSet(ADDRESSES.base.soEthVault) &&
    isSet(ADDRESSES.fuse.soEthVault) &&
    isSet(ADDRESSES.fuse.soEthTeller)
  ) {
    assets.push({
      symbol: 'soETH',
      token: ADDRESSES.fuse.soEthVault,
      decimals: 18,
      route: 'vault_bridge',
      teller: ADDRESSES.fuse.soEthTeller,
    });
  }
  return assets;
};

/**
 * One row per asset the Safe holds on Fuse, in the order given. A zero balance is left out.
 *
 * `prices` are USD per whole token. A stablecoin with no price counts at $1; a vault share with
 * none counts as $0 toward the threshold but is still moved.
 */
export const buildFuseMigrationItems = (
  assets: FuseMigrationAsset[],
  balances: readonly bigint[],
  minimums: Readonly<Record<string, bigint>>,
  prices: Readonly<Record<string, number | undefined>>,
): FuseMigrationItem[] =>
  assets.flatMap((asset, index) => {
    const amount = balances[index] ?? 0n;
    if (amount <= 0n) return [];

    const fallbackPrice = asset.route === 'deposit_address' ? 1 : 0;
    const price = prices[asset.symbol] ?? fallbackPrice;
    const minimum =
      asset.route === 'vault_bridge' && asset.teller
        ? (minimums[asset.teller.toLowerCase()] ?? 0n)
        : 0n;

    return [
      {
        ...asset,
        amount,
        valueUsd: Number(formatUnits(amount, asset.decimals)) * price,
        minimum,
        movable: amount >= minimum,
      },
    ];
  });

export const movableFuseMigrationItems = (items: FuseMigrationItem[]) =>
  items.filter(item => item.movable);

export const movableFuseMigrationUsd = (items: FuseMigrationItem[]) =>
  movableFuseMigrationItems(items).reduce((total, item) => total + item.valueUsd, 0);

export interface FuseMigrationCall {
  to: Address;
  data: Hex;
  value: bigint;
}

export interface FuseMigrationBatch {
  /** What this user operation moves. */
  items: FuseMigrationItem[];
  calls: FuseMigrationCall[];
}

interface MigrationTargets {
  /** Where the shares land on Base: the Safe the Base card module is registered on. */
  baseSafeAddress: Address;
  /** The user's WALLET direct-deposit address. Required when any stablecoin moves. */
  depositAddress?: Address;
}

/**
 * The Fuse user operations that move every movable item, in the order they are sent.
 *
 * At most ONE stablecoin transfer to the deposit address per operation: the backend opens one
 * deposit session per transaction (a unique index on `transactionHash`), so a second token sent
 * in the same transaction would never be picked up. The first operation carries every vault
 * bridge and the first stablecoin; each further stablecoin gets an operation of its own.
 */
export const buildFuseMigrationBatches = ({
  items,
  ...targets
}: { items: FuseMigrationItem[] } & MigrationTargets): FuseMigrationBatch[] => {
  const movable = movableFuseMigrationItems(items);
  const vaults = movable.filter(item => item.route === 'vault_bridge');
  const [firstStable, ...otherStables] = movable.filter(item => item.route === 'deposit_address');

  const firstItems = firstStable ? [...vaults, firstStable] : vaults;
  const groups = [firstItems, ...otherStables.map(item => [item])].filter(group => group.length);

  return groups.map(group => ({
    items: group,
    calls: group.flatMap(item => callsForItem(item, targets)),
  }));
};

/**
 * Vault shares: approve the paymaster for exactly the amount, then `sponsorBridge` to the Safe's
 * address on Base. Stablecoins: a plain transfer to the WALLET deposit address.
 */
function callsForItem(
  item: FuseMigrationItem,
  { baseSafeAddress, depositAddress }: MigrationTargets,
): FuseMigrationCall[] {
  if (item.route === 'vault_bridge') {
    const bridgeWildCard = encodeAbiParameters(parseAbiParameters('uint32'), [BASE_LZ_EID]);
    if (!item.teller) throw new Error(`No Fuse teller for ${item.symbol}`);
    return [
      {
        to: item.token,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [ADDRESSES.fuse.bridgePaymasterAddress, item.amount],
        }),
        value: 0n,
      },
      {
        to: ADDRESSES.fuse.bridgePaymasterAddress,
        data: encodeFunctionData({
          abi: BridgePayamster_ABI,
          functionName: 'sponsorBridge',
          args: [item.teller, item.amount, baseSafeAddress, bridgeWildCard],
        }),
        value: 0n,
      },
    ];
  }

  if (!depositAddress || !isSet(depositAddress)) {
    throw new Error('No deposit address to move USDC and USDT to Base');
  }
  return [
    {
      to: item.token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [depositAddress, item.amount],
      }),
      value: 0n,
    },
  ];
}

/** "12.34", trimmed to at most `maxDecimals` without rounding up. */
export const formatMigrationAmount = (item: Pick<FuseMigrationItem, 'amount' | 'decimals'>) => {
  const maxDecimals = item.decimals > 6 ? 6 : 2;
  const [whole, fraction = ''] = formatUnits(item.amount, item.decimals).split('.');
  const trimmed = fraction.slice(0, maxDecimals).replace(/0+$/, '');
  if (!trimmed && whole === '0' && item.amount > 0n) return `<0.${'0'.repeat(maxDecimals - 1)}1`;
  return trimmed ? `${whole}.${trimmed}` : whole;
};
