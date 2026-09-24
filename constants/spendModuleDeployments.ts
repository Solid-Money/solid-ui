import { Address } from 'viem';
import { base, fuse } from 'viem/chains';

/**
 * Every spend-module deployment the app can enable, in one place, keyed by chain.
 *
 * ## Why this is a separate file from `lib/config.ts`
 *
 * `ADDRESSES` is organised by chain and then by product — a Fuse entry holds the vault, the
 * teller, the bridge paymaster and the cash module side by side. That shape answers "what is
 * deployed on Fuse", which is the wrong question for this feature. What the card screen needs is
 * "which spend-module instances exist, and what does each one need to be enabled", and answering it
 * from `ADDRESSES` means the reader assembles a deployment out of four keys and has no way to tell
 * they got all four.
 *
 * So the spend module's contracts live here, together, with the same shape per chain. This mirrors
 * `cash/config/spend-module.config.ts` on the backend deliberately: the two agree on which chains
 * exist and what each one is called, and drift between them is the failure that would offer a user
 * a transaction the backend then refuses to confirm.
 *
 * ## Addresses come from env, and `undefined` is a normal state
 *
 * Base was unallocated when this was written — only the Chainlink quote adapter exists there. A
 * deployment missing its module or lens is `configured: false`, and the enable card is not
 * rendered. Never substitute another chain's address to fill a gap: instances are separate
 * accounting universes and are not interchangeable.
 *
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time by **static** reference only, so each one
 * is written out in full below rather than looked up by a computed key — a computed key silently
 * resolves to `undefined` in a release build.
 */

/** The unit an instance's amounts are denominated in — its accounting unit, not a display choice. */
export type SettlementCurrency = 'USD' | 'EUR';

export interface SpendModuleDeployment {
  chainId: number;
  /** Viem chain, for building the user operation. */
  chain: typeof fuse | typeof base;
  /** Human name for the chain chip. */
  name: string;
  /**
   * The accounting unit.
   *
   * `USD` for Base as well as Fuse, which is the thing most worth not getting wrong here. Base is
   * the EURC deployment, but the module's unit there is dollars and EURC is priced within it as a
   * floating asset at around 1.08 — the euro is the **asset**, not the unit. A limit or a balance
   * from the Base instance is a dollar figure.
   */
  currency: SettlementCurrency;
  /** The asset this deployment exists to let people spend, for copy. */
  assetSymbol: string;
  /** `SolidCashModuleV2`. The address the Safe enables and registers against. */
  moduleAddress?: Address;
  /** `SolidSpendLens`. The cohort-aware read of what the Safe can spend. */
  spendLensAddress?: Address;
  /** The spendable asset on this chain. */
  spendTokenAddress?: Address;
}

const envAddress = (value: string | undefined): Address | undefined => {
  const trimmed = value?.trim();

  // A zero address is treated as unset rather than as a target. It is what an unfilled template
  // leaves behind, and letting it through produces a transaction that fails at the RPC instead of
  // at the config check, a long way from what was actually wrong.
  if (!trimmed || /^0x0{40}$/i.test(trimmed)) return undefined;

  return trimmed as Address;
};

/** Fuse — the dollar book, and the instance every cardholder spends from today. */
export const FUSE_SPEND_DEPLOYMENT: SpendModuleDeployment = {
  chainId: fuse.id,
  chain: fuse,
  name: 'Fuse',
  currency: 'USD',
  assetSymbol: 'soUSD',
  moduleAddress: envAddress(process.env.EXPO_PUBLIC_CASH_MODULE_V2_ADDRESS),
  spendLensAddress: envAddress(process.env.EXPO_PUBLIC_SPEND_LENS_V2_ADDRESS),
  spendTokenAddress: '0x75333830E7014e909535389a6E5b0C02aA62ca27',
};

/** Base — the EURC instance. Dollar-denominated accounting, euro-denominated asset. */
export const BASE_SPEND_DEPLOYMENT: SpendModuleDeployment = {
  chainId: base.id,
  chain: base,
  name: 'Base',
  currency: 'USD',
  assetSymbol: 'EURC',
  moduleAddress: envAddress(process.env.EXPO_PUBLIC_BASE_CASH_MODULE_ADDRESS),
  spendLensAddress: envAddress(process.env.EXPO_PUBLIC_BASE_SPEND_LENS_ADDRESS),
  spendTokenAddress: envAddress(process.env.EXPO_PUBLIC_BASE_EURC_ADDRESS),
};

export const SPEND_MODULE_DEPLOYMENTS: readonly SpendModuleDeployment[] = [
  FUSE_SPEND_DEPLOYMENT,
  BASE_SPEND_DEPLOYMENT,
];

/**
 * Whether this build can actually execute an enablement on a deployment.
 *
 * The module is the call target; without it there is no transaction to build. The lens is what the
 * backend reads to verify the result, so a build that has one but not the other would land a
 * transaction the confirm endpoint could never prove — which looks to the user like the enablement
 * silently failing.
 */
export const isSpendDeploymentConfigured = (
  deployment: SpendModuleDeployment | undefined,
): deployment is SpendModuleDeployment & { moduleAddress: Address } =>
  Boolean(deployment?.moduleAddress && deployment?.spendLensAddress);

export const spendDeploymentFor = (chainId: number): SpendModuleDeployment | undefined =>
  SPEND_MODULE_DEPLOYMENTS.find(deployment => deployment.chainId === chainId);
