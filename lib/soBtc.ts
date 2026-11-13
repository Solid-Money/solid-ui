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
 * One share, two vaults that never bridge their assets. WBTC deposited on Ethereum stays in the
 * Ethereum vault and its shares are bridged to Base in the same transaction; cbBTC deposited on
 * Base stays in the Base vault. Both accountants carry the same rate, so 1 WBTC and 1 cbBTC mint
 * the same number of shares. All shares sit on Base, where the card can use them.
 *
 * A withdrawal picks what it pays out: cbBTC from the Base vault (one step, on Base), or WBTC
 * from the Ethereum vault (bridge the shares to Ethereum, then request there). Each side can only
 * pay what its vault holds right now, which is why the withdraw form shows "available now" per
 * option.
 */

/**
 * Every soBTC contract this build talks to, deployed 2026-11-13 (boring-vault
 * deployments/addresses/{Mainnet,Base}/soBTC.json). Owned by the Ethereum Safe 0x6B26 and the
 * Base Safe 0x5Eb1. Zeroing them keeps soBTC out of the app entirely (see {@link isSoBtcConfigured}).
 */
export const SOBTC_ADDRESSES = {
  ethereum: {
    vault: '0x4518Af8B68DBabc2Bdf9b6922ACA30ea8939979F' as Address,
    accountant: '0xfb513e4Dc121a455E43017B37c09dcd4827f5A01' as Address,
    teller: '0x20Ec4b175a463470A6122484113Afd0BC4ca5105' as Address,
    boringQueue: '0x0800bb6AF4668e14186F5cd6CD357e1aA81A3802' as Address,
  },
  base: {
    vault: '0xb5Fb6a807c1B35419CCC90480287305314D77B52' as Address,
    accountant: '0x0C5BB76738BD2D095dBAb4a9Fe97D369284F9dD7' as Address,
    teller: '0xBBd9100Be5712594B5db736e5280A4C0535Ee4Ec' as Address,
    boringQueue: '0x7d61eac254d9510f10cc40C07BB59a112792E832' as Address,
  },
} as const;

/** WBTC on Ethereum: the Ethereum vault's base asset and what an Ethereum withdrawal pays. */
export const WBTC_ETHEREUM: Address = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
/** Coinbase cbBTC on Base: the Base vault's base asset and what a Base withdrawal pays. */
export const CBBTC_BASE: Address = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';

/** Whether this build has both soBTC deployments. Every soBTC surface is off without them. */
export const isSoBtcConfigured = [
  ...Object.values(SOBTC_ADDRESSES.ethereum),
  ...Object.values(SOBTC_ADDRESSES.base),
].every(address => address !== zeroAddress);

/** Shares, WBTC and cbBTC all have 8 decimals. */
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

/** What a soBTC withdrawal can pay out, and where. */
export type SoBtcWithdrawOption = {
  chainId: SoBtcChainId;
  chain: Chain;
  /** The asset paid out, as the app names it. */
  asset: 'cbBTC' | 'WBTC';
  assetAddress: Address;
  networkName: string;
  vault: Address;
  accountant: Address;
  teller: Address;
  boringQueue: Address;
  /** Whether the shares (always on Base) must be bridged before the request. */
  requiresBridge: boolean;
  /** Rough time to the payout, shown before the user picks the option. */
  timeLabel: string;
  /** What the option costs beyond the solver fee, shown before the user picks it. */
  costLabel: string;
};

export const SOBTC_WITHDRAW_OPTIONS: Record<SoBtcChainId, SoBtcWithdrawOption> = {
  [base.id]: {
    chainId: base.id,
    chain: base,
    asset: 'cbBTC',
    assetAddress: CBBTC_BASE,
    networkName: 'Base',
    vault: SOBTC_ADDRESSES.base.vault,
    accountant: SOBTC_ADDRESSES.base.accountant,
    teller: SOBTC_ADDRESSES.base.teller,
    boringQueue: SOBTC_ADDRESSES.base.boringQueue,
    requiresBridge: false,
    timeLabel: 'Usually within 3 days',
    costLabel: 'No network fee',
  },
  [mainnet.id]: {
    chainId: mainnet.id,
    chain: mainnet,
    asset: 'WBTC',
    assetAddress: WBTC_ETHEREUM,
    networkName: 'Ethereum',
    vault: SOBTC_ADDRESSES.ethereum.vault,
    accountant: SOBTC_ADDRESSES.ethereum.accountant,
    teller: SOBTC_ADDRESSES.ethereum.teller,
    boringQueue: SOBTC_ADDRESSES.ethereum.boringQueue,
    requiresBridge: true,
    timeLabel: '2 steps, usually within 3 days',
    costLabel: 'Bridge fee in ETH on Base',
  },
};

/** The order the withdraw form lists the options in: the fast, cheap one first. */
export const SOBTC_WITHDRAW_OPTION_ORDER: SoBtcChainId[] = [base.id, mainnet.id];

/** The deposit asset the vault on `chainId` takes. */
export const getSoBtcDepositAsset = (chainId: number): Address | undefined =>
  chainId === mainnet.id ? WBTC_ETHEREUM : chainId === base.id ? CBBTC_BASE : undefined;

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
    address: SOBTC_WITHDRAW_OPTIONS[chainId].accountant,
    abi: Accountant,
    functionName: 'getRateInQuoteSafe',
    args: [SOBTC_WITHDRAW_OPTIONS[chainId].assetAddress],
  });

/** The base asset `chainId`'s vault holds right now, before any queued request is paid. */
export const readSoBtcVaultBalance = (chainId: SoBtcChainId) =>
  readContract(publicClient(chainId), {
    address: SOBTC_WITHDRAW_OPTIONS[chainId].assetAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [SOBTC_WITHDRAW_OPTIONS[chainId].vault],
  });

/**
 * Shares in `chainId`'s queue that the solver can still pay out of that vault: every open request
 * for the chain's asset that hasn't passed its deadline. Expired requests can't be solved (only
 * cancelled), so they hold no liquidity. The queue tracks requests on-chain, so one read covers them.
 */
export const readSoBtcQueuedShares = async (chainId: SoBtcChainId): Promise<bigint> => {
  const option = SOBTC_WITHDRAW_OPTIONS[chainId];
  const [, requests] = await readContract(publicClient(chainId), {
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
    address: SOBTC_WITHDRAW_OPTIONS[fromChainId].teller,
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
 * cbBTC on Base: approve the Base VAULT (the BoringVault pulls the asset in `enter`) for exactly
 * the amount, then deposit through the teller, which mints to the caller. Both from the Safe in
 * one user operation.
 */
export const buildSoBtcBaseDepositCalls = (amount: bigint, minimumMint: bigint): Call[] => [
  {
    to: CBBTC_BASE,
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
      args: [CBBTC_BASE, amount, minimumMint],
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

/** Step 1 of a WBTC withdrawal: send `shares` from Base to the same Safe on Ethereum. */
export const buildSoBtcBridgeToEthereumCall = (shares: bigint, to: Address, fee: bigint): Call => ({
  to: SOBTC_ADDRESSES.base.teller,
  data: encodeFunctionData({
    abi: ETHEREUM_TELLER_ABI,
    functionName: 'bridge',
    args: [shares, to, soBtcBridgeWildCard(mainnet.id), NATIVE_FEE_TOKEN, fee],
  }),
  value: fee,
});

/** The withdraw request on `chainId`'s queue, paying that chain's asset. */
export const buildSoBtcWithdrawRequestCall = (
  chainId: SoBtcChainId,
  shares: bigint,
  secondsToDeadline: number,
): Call => {
  const option = SOBTC_WITHDRAW_OPTIONS[chainId];
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
