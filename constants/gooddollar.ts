import { fuse } from 'wagmi/chains';

/**
 * GoodDollar UBI configuration.
 *
 * We integrate GoodDollar via the viem-based `@goodsdks/citizen-sdk` (the
 * `<claim-button>` web component is a Lit/DOM custom element and cannot render
 * in React Native).
 *
 * Identity (Face Verification) and claiming are EOA-only in GoodDollar: the FV
 * link is signed with `personal_sign` and verified server-side via `ecrecover`,
 * and the whitelisted address is the one that calls `claim()`. Our on-chain
 * account is a Safe smart account, which cannot satisfy that, so we drive the
 * flow with the user's Turnkey signer EOA (`user.walletAddress`). Claimed G$
 * therefore lands in that EOA on Fuse.
 *
 * Only Fuse is supported for now; Celo is planned for a future release.
 */

// GoodDollar SDK environment. "production" targets the live mainnet contracts
// on Fuse (and Celo), independent of Solid's own EXPO_PUBLIC_ENVIRONMENT.
export const GOODDOLLAR_ENV = 'production' as const;

export const GOODDOLLAR_CHAIN_ID = fuse.id; // 122

// G$ has 2 decimals on Fuse (18 on Celo).
export const G_DOLLAR_DECIMALS = 2;

export const G_DOLLAR_SYMBOL = 'G$';

// Fuse mainnet (production) contract addresses, mirrored from
// `@goodsdks/citizen-sdk` chainConfigs[122].contracts.production.
export const GOODDOLLAR_FUSE = {
  identity: '0x2F9C28de9e6d44b71B91b8BA337A5D82e308E7BE',
  ubiScheme: '0xd253A5203817225e9768C05E5996d642fb96bA86',
  faucet: '0x01ab5966C1d742Ae0CFF7f14cC0F4D85156e83d9',
  gdToken: '0x495d133B938596C9984d462F007B676bDc57eCEC',
} as const;

// Fallback minimum native FUSE (wei) the signer EOA should hold before a
// claim/sweep, used only when on-chain gas estimation is unavailable (~0.01 FUSE).
export const GOODDOLLAR_GAS_FLOOR_WEI = 10_000_000_000_000_000n;

// Deep-link path the GoodDollar Face Verification flow redirects back to.
export const GOODDOLLAR_REDIRECT_PATH = 'gooddollar';

export const getGoodDollarExplorerTxUrl = (hash: string) => `https://explorer.fuse.io/tx/${hash}`;
