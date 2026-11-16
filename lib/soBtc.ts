import {
  type Address,
  type Chain,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  parseAbiParameters,
  zeroAddress,
} from 'viem';
import { readContract } from 'viem/actions';
import { base, mainnet } from 'viem/chains';

import Accountant from '@/lib/abis/Accountant';
import BoringQueue_ABI from '@/lib/abis/BoringQueue';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { publicClient } from '@/lib/wagmi';

/**
 * soBTC: BTC Yield.
 *
 * One share, two vaults, both taking WBTC. WBTC deposited on Ethereum stays in the Ethereum vault
 * and its shares are bridged to Base in the same transaction; WBTC deposited on Base (BitGo's
 * LayerZero OFT) stays in the Base vault and its shares mint there. All shares sit on Base, where
 * the card can use them.
 *
 * Every withdrawal pays WBTC on Ethereum: the shares are bridged Base → Ethereum through the Base
 * teller, then requested on the Ethereum queue. Base has no withdraw queue.
 */

/**
 * Every soBTC contract this build talks to (boring-vault deployments/addresses/{Mainnet,Base}/
 * soBTC.json). The Ethereum stack was deployed 2026-11-13. The Base stack was redeployed to take
 * WBTC; the cbBTC one it replaces (vault 0xb5Fb…7B52, its queue and solver) is retired and must not
 * be used. Base has no withdraw queue. Zeroing any of these keeps soBTC out of the app entirely
 * (see {@link isSoBtcConfigured}).
 */
export const SOBTC_ADDRESSES = {
  ethereum: {
    vault: '0x4518Af8B68DBabc2Bdf9b6922ACA30ea8939979F' as Address,
    accountant: '0xfb513e4Dc121a455E43017B37c09dcd4827f5A01' as Address,
    teller: '0x20Ec4b175a463470A6122484113Afd0BC4ca5105' as Address,
    boringQueue: '0x0800bb6AF4668e14186F5cd6CD357e1aA81A3802' as Address,
  },
  base: {
    vault: '0xBd51647c783A917c797873c6c5A489ff197fb51e' as Address,
    accountant: '0xaC88737d45421EA93eEe11f0E30d2D2c6eC51382' as Address,
    teller: '0x49d88bd2b250d57Fc2c14a16A3420Fb149078d00' as Address,
  },
} as const;

/** WBTC on Ethereum: the Ethereum vault's base asset, and what every withdrawal pays. */
export const WBTC_ETHEREUM: Address = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
/** WBTC on Base (BitGo's LayerZero OFT): the Base vault's base asset. */
export const WBTC_BASE: Address = '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c';

/** Whether this build has both soBTC deployments. Every soBTC surface is off without them. */
export const isSoBtcConfigured = [
  ...Object.values(SOBTC_ADDRESSES.ethereum),
  ...Object.values(SOBTC_ADDRESSES.base),
].every(address => address !== zeroAddress);

/** Shares and WBTC (on both chains) all have 8 decimals. */
export const SOBTC_DECIMALS = 8;

/** LayerZero endpoint ids of the two soBTC tellers' chains. */
export const SOBTC_LZ_EID = {
  [mainnet.id]: 30101,
  [base.id]: 30184,
} as const;

/** Paying the LayerZero fee in the chain's native token. */
export const NATIVE_FEE_TOKEN: Address = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

/**
 * How far below the quoted share count a deposit may mint before it reverts. The rate only moves
 * on an accountant update, so this covers one landing between the quote and the transaction.
 */
export const SOBTC_MINT_SLIPPAGE_BPS = 50n;

/*
 * The teller's LayerZero send requires `msg.value` to EQUAL the quoted native fee (OAppAuthSender
 * `_payNative`), so a bridge sends exactly a fee quoted just before it, as both value and maxFee.
 * There is no headroom to add: a surplus reverts the send just as a shortfall does.
 */

/** `abi.encode(uint32 eid)`: the teller's bridge wildcard naming the destination chain. */
export const soBtcBridgeWildCard = (toChainId: SoBtcChainId) =>
  encodeAbiParameters(parseAbiParameters('uint32'), [SOBTC_LZ_EID[toChainId]]);

export type SoBtcChainId = typeof mainnet.id | typeof base.id;

/** soBTC's contracts on one chain, and the WBTC its vault takes there. */
export type SoBtcChainConfig = {
  vault: Address;
  accountant: Address;
  teller: Address;
  /** The vault's base asset: WBTC on that chain. */
  asset: Address;
};

export const SOBTC_CHAINS: Record<SoBtcChainId, SoBtcChainConfig> = {
  [mainnet.id]: {
    vault: SOBTC_ADDRESSES.ethereum.vault,
    accountant: SOBTC_ADDRESSES.ethereum.accountant,
    teller: SOBTC_ADDRESSES.ethereum.teller,
    asset: WBTC_ETHEREUM,
  },
  [base.id]: {
    vault: SOBTC_ADDRESSES.base.vault,
    accountant: SOBTC_ADDRESSES.base.accountant,
    teller: SOBTC_ADDRESSES.base.teller,
    asset: WBTC_BASE,
  },
};

/** The one way out of soBTC: WBTC on Ethereum, from the Ethereum queue. */
export const SOBTC_WITHDRAW = {
  chainId: mainnet.id,
  chain: mainnet as Chain,
  /** The asset paid out, as the app names it. */
  asset: 'WBTC',
  assetAddress: WBTC_ETHEREUM,
  networkName: 'Ethereum',
  vault: SOBTC_ADDRESSES.ethereum.vault,
  boringQueue: SOBTC_ADDRESSES.ethereum.boringQueue,
  /** Rough time to the payout. */
  timeLabel: '2 steps, usually within 3 days',
  /** What it costs beyond the solver fee. */
  costLabel: 'Bridge fee in ETH on Base',
} as const;

/** The deposit asset the vault on `chainId` takes: WBTC on Ethereum or on Base. */
export const getSoBtcDepositAsset = (chainId: number): Address | undefined =>
  chainId === mainnet.id || chainId === base.id ? SOBTC_CHAINS[chainId].asset : undefined;

// ── Display ──────────────────────────────────────────────────────────────────

/** BTC amounts show this many decimals: 0.000001 BTC is about a tenth of a US cent. */
export const BTC_DISPLAY_DECIMALS = 6;

/**
 * A BTC amount for display: up to six decimals, trailing zeros dropped, and anything above zero
 * but below 0.000001 shown as "< 0.000001" rather than a misleading 0.
 */
export const formatBtcAmount = (amount: number | undefined, unit = 'BTC'): string => {
  const value = Number.isFinite(amount) ? (amount as number) : 0;
  const suffix = unit ? ` ${unit}` : '';
  const min = 10 ** -BTC_DISPLAY_DECIMALS;
  if (value > 0 && value < min) return `< ${min.toFixed(BTC_DISPLAY_DECIMALS)}${suffix}`;
  const digits = value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: BTC_DISPLAY_DECIMALS,
  });
  return `${digits}${suffix}`;
};

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * The share → BTC rate on `chainId`'s accountant, in 8-decimal base units. `Safe` reverts while
 * the accountant is paused, which is what a deposit or withdraw should do then too.
 */
export const readSoBtcRate = (chainId: SoBtcChainId) =>
  readContract(publicClient(chainId), {
    address: SOBTC_CHAINS[chainId].accountant,
    abi: Accountant,
    functionName: 'getRateInQuoteSafe',
    args: [SOBTC_CHAINS[chainId].asset],
  });

/** The WBTC the Ethereum vault holds right now, before any queued request is paid. */
export const readSoBtcVaultBalance = () =>
  readContract(publicClient(SOBTC_WITHDRAW.chainId), {
    address: SOBTC_WITHDRAW.assetAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [SOBTC_WITHDRAW.vault],
  });

/**
 * Shares in the Ethereum queue that the solver can still pay out of the Ethereum vault: every open
 * WBTC request that hasn't passed its deadline. Expired requests can't be solved (only cancelled),
 * so they hold no liquidity. The queue tracks requests on-chain, so one read covers them.
 */
export const readSoBtcQueuedShares = async (): Promise<bigint> => {
  const option = SOBTC_WITHDRAW;
  const [, requests] = await readContract(publicClient(option.chainId), {
    address: option.boringQueue,
    abi: BoringQueue_ABI,
    functionName: 'getWithdrawRequests',
  });
  const now = BigInt(Math.floor(Date.now() / 1000));
  return requests.reduce((sum, request) => {
    const deadline =
      BigInt(request.creationTime) +
      BigInt(request.secondsToMaturity) +
      BigInt(request.secondsToDeadline);
    const live =
      request.assetOut.toLowerCase() === option.assetAddress.toLowerCase() && deadline >= now;
    return live ? sum + BigInt(request.amountOfShares) : sum;
  }, 0n);
};

/** The LayerZero fee, in native wei, for the `fromChainId` teller to send shares across. */
export const readSoBtcBridgeFee = (
  fromChainId: SoBtcChainId,
  toChainId: SoBtcChainId,
  to: Address,
) =>
  readContract(publicClient(fromChainId), {
    address: SOBTC_CHAINS[fromChainId].teller,
    abi: ETHEREUM_TELLER_ABI,
    functionName: 'previewFee',
    args: [0n, to, soBtcBridgeWildCard(toChainId), NATIVE_FEE_TOKEN],
  });

// ── Math ─────────────────────────────────────────────────────────────────────

/**
 * The `minimumMint` for depositing `amount` (8 decimals) at `rate` (BTC per share, 8 decimals).
 * Mirrors the teller, `shares = amount * ONE_SHARE / rate`, less the slippage allowance.
 */
export const getSoBtcMinimumMint = (amount: bigint, rate: bigint): bigint => {
  if (amount <= 0n || rate <= 0n) return 0n;
  const expectedShares = (amount * 10n ** BigInt(SOBTC_DECIMALS)) / rate;
  return (expectedShares * (10_000n - SOBTC_MINT_SLIPPAGE_BPS)) / 10_000n;
};

/** Shares → BTC at `rate`. */
export const soBtcSharesToAssets = (shares: bigint, rate: bigint): bigint =>
  (shares * rate) / 10n ** BigInt(SOBTC_DECIMALS);

/** BTC → shares at `rate`, rounded down so the result never pays out more than `assets`. */
export const soBtcAssetsToShares = (assets: bigint, rate: bigint): bigint =>
  rate > 0n ? (assets * 10n ** BigInt(SOBTC_DECIMALS)) / rate : 0n;

// ── Calls ────────────────────────────────────────────────────────────────────

type Call = { to: Address; data: `0x${string}`; value: bigint };

/**
 * WBTC on Base: approve the Base VAULT (the BoringVault pulls the asset in `enter`) for exactly
 * the amount, then deposit through the teller, which mints to the caller. Both from the Safe in
 * one user operation.
 */
export const buildSoBtcBaseDepositCalls = (amount: bigint, minimumMint: bigint): Call[] => [
  {
    to: WBTC_BASE,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [SOBTC_ADDRESSES.base.vault, amount],
    }),
    value: 0n,
  },
  {
    to: SOBTC_ADDRESSES.base.teller,
    data: encodeFunctionData({
      abi: ETHEREUM_TELLER_ABI,
      functionName: 'deposit',
      args: [WBTC_BASE, amount, minimumMint],
    }),
    value: 0n,
  },
];

/** WBTC on Ethereum: approve the Ethereum vault for exactly the amount. */
export const buildSoBtcEthereumApproveCall = (amount: bigint): Call => ({
  to: WBTC_ETHEREUM,
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [SOBTC_ADDRESSES.ethereum.vault, amount],
  }),
  value: 0n,
});

/**
 * WBTC on Ethereum: deposit and bridge the minted shares to `to` on Base in one call, paying the
 * LayerZero fee as value. The WBTC stays in the Ethereum vault.
 *
 * Relies on the Ethereum teller's `shareLockPeriod` staying 0 (it is 0 since deploy): the
 * deposit locks the caller's new shares for that long, and the bridge in the same call would
 * then revert on the lock.
 */
export const buildSoBtcEthereumDepositCall = (
  amount: bigint,
  minimumMint: bigint,
  to: Address,
  fee: bigint,
): Call => ({
  to: SOBTC_ADDRESSES.ethereum.teller,
  data: encodeFunctionData({
    abi: ETHEREUM_TELLER_ABI,
    functionName: 'depositAndBridge',
    args: [
      WBTC_ETHEREUM,
      amount,
      minimumMint,
      to,
      soBtcBridgeWildCard(base.id),
      NATIVE_FEE_TOKEN,
      fee,
    ],
  }),
  value: fee,
});

/** Step 1 of a withdrawal: send `shares` from Base to the same Safe on Ethereum. */
export const buildSoBtcBridgeToEthereumCall = (shares: bigint, to: Address, fee: bigint): Call => ({
  to: SOBTC_ADDRESSES.base.teller,
  data: encodeFunctionData({
    abi: ETHEREUM_TELLER_ABI,
    functionName: 'bridge',
    args: [shares, to, soBtcBridgeWildCard(mainnet.id), NATIVE_FEE_TOKEN, fee],
  }),
  value: fee,
});

/** Step 2 of a withdrawal: the request on the Ethereum queue, paying WBTC there. */
export const buildSoBtcWithdrawRequestCall = (shares: bigint, secondsToDeadline: number): Call => {
  const option = SOBTC_WITHDRAW;
  return {
    to: option.boringQueue,
    data: encodeFunctionData({
      abi: BoringQueue_ABI,
      functionName: 'requestOnChainWithdraw',
      args: [option.assetAddress, shares, 1, secondsToDeadline],
    }),
    value: 0n,
  };
};
