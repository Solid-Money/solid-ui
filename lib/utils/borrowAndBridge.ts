import * as Sentry from '@sentry/react-native';
import { Address } from 'abitype';
import { Chain, erc20Abi, pad, TransactionReceipt } from 'viem';
import { readContract } from 'viem/actions';
import { fuse, mainnet } from 'viem/chains';
import { encodeFunctionData, parseUnits } from 'viem/utils';

import { USDC_STARGATE } from '@/constants/addresses';
import { useActivityActions } from '@/hooks/useActivityActions';
import { AaveV3Pool_ABI } from '@/lib/abis/AaveV3Pool';
import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import { CardDepositManager_ABI } from '@/lib/abis/CardDepositManager';
import { ADDRESSES } from '@/lib/config';
import { executeTransactions, USER_CANCELLED_TRANSACTION } from '@/lib/execute';
import { StargateQuoteParams, TransactionType } from '@/lib/types';
import { getStargateChainId, getStargateQuote } from '@/lib/utils/stargate';
import { publicClient } from '@/lib/wagmi';

import type { SmartAccountClient } from 'permissionless';

// EIP-3009 / Aave LTV — keep one source of truth shared by every flow that
// borrows USDC against soUSD on Fuse and bridges via Stargate to a chosen
// destination address.
const SO_USD_LTV = 70n;

// AccountantWithRateProviders.getRate() — shared between card + agent flows.
const ACCOUNTANT_ABI = [
  {
    inputs: [],
    name: 'getRate',
    outputs: [{ internalType: 'uint256', name: 'rate', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface BorrowAndBridgeUser {
  safeAddress: string;
  suborgId: string;
  signWith: string;
  userId: string;
}

export interface BorrowAndBridgeParams {
  /** Connected user (must have safeAddress + AA signer context). */
  user: BorrowAndBridgeUser;
  /** Receiver of bridged USDC on the destination chain. */
  destinationAddress: Address;
  /** EVM chain id of the destination (e.g. base.id, arbitrum.id). */
  destinationChainId: number;
  /** Stargate's chain key for the destination ('base', 'arbitrum', ...). */
  destinationChainKey: string;
  /** USDC contract on the destination chain. */
  destinationToken: Address;
  /** Borrow amount as a human-readable USDC string (e.g. '10.5'). */
  amountToBorrow: string;
  /** AA signer factory used by the card flow (`useUser().safeAA`). */
  safeAA: (chain: Chain, suborgId: string, signWith: string) => Promise<SmartAccountClient>;
  /** Activity tracking — wires receipt + status into the in-app feed. */
  trackTransaction: ReturnType<typeof useActivityActions>['trackTransaction'];
  /** Activity payload metadata. */
  activityType: TransactionType;
  activityTitle: string;
  /** Optional Sentry/analytics breadcrumb tag (purely cosmetic). */
  flowTag?: string;
}

/**
 * Core "borrow USDC.e against soUSD on Fuse → Stargate-bridge to a
 * destination" flow used by both the card-funding and agent-wallet
 * deposit paths. The CardDepositManager is destination-agnostic (the
 * receiver allowlist is gated by `isWhitelistEnabled` which is off in
 * prod), so the same on-chain plumbing handles both.
 */
export async function executeBorrowAndBridge(
  params: BorrowAndBridgeParams,
): Promise<TransactionReceipt | typeof USER_CANCELLED_TRANSACTION> {
  const {
    user,
    destinationAddress,
    destinationChainId,
    destinationChainKey,
    destinationToken,
    amountToBorrow,
    safeAA,
    trackTransaction,
    activityType,
    activityTitle,
    flowTag = 'borrow_and_bridge',
  } = params;

  const rate = await readContract(publicClient(mainnet.id), {
    address: ADDRESSES.ethereum.accountant,
    abi: ACCOUNTANT_ABI,
    functionName: 'getRate',
  });

  const borrowAmountWei = parseUnits(amountToBorrow, 6);
  const supplyAmountWei = (borrowAmountWei * 100n * 1000000n) / (SO_USD_LTV * rate);

  const supplyApproveCalldata = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [ADDRESSES.fuse.aaveV3Pool, supplyAmountWei],
  });

  const supplyCalldata = encodeFunctionData({
    abi: AaveV3Pool_ABI,
    functionName: 'supply',
    args: [ADDRESSES.fuse.vault, supplyAmountWei, user.safeAddress as Address, 0],
  });

  const borrowCalldata = encodeFunctionData({
    abi: AaveV3Pool_ABI,
    functionName: 'borrow',
    args: [USDC_STARGATE, borrowAmountWei, 2, 0, user.safeAddress as Address],
  });

  Sentry.addBreadcrumb({
    message: `Starting ${flowTag} transaction`,
    category: 'bridge',
    data: {
      amount: amountToBorrow,
      amountWei: borrowAmountWei.toString(),
      userAddress: user.safeAddress,
      destinationAddress,
      destinationChainId,
      chainId: fuse.id,
    },
  });

  // 5% slippage envelope on the destination amount.
  const dstAmountMin = (borrowAmountWei * 95n) / 100n;

  const quoteParams: StargateQuoteParams = {
    srcToken: USDC_STARGATE,
    srcChainKey: 'fuse',
    dstToken: destinationToken,
    dstChainKey: destinationChainKey,
    srcAddress: ADDRESSES.fuse.bridgePaymasterAddress,
    dstAddress: destinationAddress,
    srcAmount: borrowAmountWei.toString(),
    dstAmountMin: dstAmountMin.toString(),
  };
  const quote = await getStargateQuote(quoteParams);
  const taxiQuote = quote.quotes.find(q => q.route.includes('taxi'));
  if (!taxiQuote) throw new Error('Taxi route not available from Stargate');
  if (taxiQuote.error) throw new Error(`Stargate quote error: ${taxiQuote.error}`);

  const bridgeStep = taxiQuote.steps.find(step => step.type === 'bridge');
  if (!bridgeStep) throw new Error('No bridge step found in Stargate quote');

  const { transaction } = bridgeStep;
  const nativeFeeAmount = BigInt(transaction.value);

  const sendParam = {
    dstEid: getStargateChainId(destinationChainId) as number,
    to: pad(destinationAddress, { size: 32 }),
    amountLD: borrowAmountWei,
    minAmountLD: dstAmountMin,
    extraOptions: '0x' as `0x${string}`,
    composeMsg: '0x' as `0x${string}`,
    oftCmd: '0x' as `0x${string}`,
  };

  const calldata = encodeFunctionData({
    abi: CardDepositManager_ABI,
    functionName: 'depositUsingStargate',
    args: [
      transaction.to as Address,
      user.safeAddress as Address,
      sendParam,
      nativeFeeAmount,
      ADDRESSES.fuse.bridgePaymasterAddress,
    ],
  });

  const transactions = [
    {
      to: ADDRESSES.fuse.vault,
      data: supplyApproveCalldata,
      value: 0n,
    },
    {
      to: ADDRESSES.fuse.aaveV3Pool,
      data: supplyCalldata,
      value: 0n,
    },
    {
      to: ADDRESSES.fuse.aaveV3Pool,
      data: borrowCalldata,
      value: 0n,
    },
    // Approve USDC.e from Safe to CardDepositManager (manager is destination-agnostic).
    {
      to: USDC_STARGATE,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [ADDRESSES.fuse.cardDepositManager, borrowAmountWei],
      }),
      value: 0n,
    },
    // Forward the LZ native fee from BridgePaymaster (which is sponsored
    // for the depositUsingStargate selector) and let the manager call
    // Stargate's send().
    {
      to: ADDRESSES.fuse.bridgePaymasterAddress,
      data: encodeFunctionData({
        abi: BridgePayamster_ABI,
        functionName: 'callWithValue',
        args: [
          ADDRESSES.fuse.cardDepositManager,
          '0x37fe667d', // depositUsingStargate selector
          calldata,
          nativeFeeAmount,
        ],
      }),
      value: 0n,
    },
  ];

  const smartAccountClient = await safeAA(fuse, user.suborgId, user.signWith);

  const result = await trackTransaction(
    {
      type: activityType,
      title: activityTitle,
      shortTitle: activityTitle,
      amount: amountToBorrow,
      symbol: 'USDC.e',
      chainId: fuse.id,
      fromAddress: user.safeAddress,
      toAddress: destinationAddress,
      metadata: {
        description: `${activityTitle} ${amountToBorrow} USDC from Fuse to ${destinationAddress} on chain ${destinationChainId}`,
        fee: transaction.value,
        sourceSymbol: 'USDC.e',
        tokenAddress: USDC_STARGATE,
      },
    },
    onUserOpHash =>
      executeTransactions(
        smartAccountClient,
        transactions,
        `${activityTitle} failed`,
        fuse,
        onUserOpHash,
      ),
  );

  const transactionResult =
    result && typeof result === 'object' && 'transaction' in result ? result.transaction : result;

  return transactionResult as TransactionReceipt | typeof USER_CANCELLED_TRANSACTION;
}
