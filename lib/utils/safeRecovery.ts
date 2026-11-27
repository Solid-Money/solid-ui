import {
  decodeFunctionData,
  erc20Abi,
  formatUnits,
  hashTypedData,
  isAddress,
  isAddressEqual,
  zeroAddress,
} from 'viem';

import type {
  SafeRecovery,
  SafeRecoveryBalance,
  SafeRecoveryBalancesResponse,
  SafeRecoveryPrepared,
  SafeRecoveryStatus,
} from '@/lib/types';
import type { Address, Hex } from 'viem';

/** What the user approved: the card they tapped. */
export type ApprovedSafeRecovery = Pick<SafeRecoveryBalance, 'chainId' | 'tokenAddress' | 'amount'>;

/**
 * The amount to move is no longer the one on the card (more arrived, or some left). Nothing is
 * signed: the screen refreshes, and the user approves the new amount by tapping again.
 */
export class SafeRecoveryAmountChangedError extends Error {
  constructor(readonly amount: string) {
    super('The balance changed. Check the new amount and try again.');
    this.name = 'SafeRecoveryAmountChangedError';
  }
}

/** EIP-712 type of a Safe transaction (Safe 1.3.0 and later). */
const SAFE_TX_TYPES = {
  SafeTx: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'operation', type: 'uint8' },
    { name: 'safeTxGas', type: 'uint256' },
    { name: 'baseGas', type: 'uint256' },
    { name: 'gasPrice', type: 'uint256' },
    { name: 'gasToken', type: 'address' },
    { name: 'refundReceiver', type: 'address' },
    { name: 'nonce', type: 'uint256' },
  ],
} as const;

const asAddress = (value: string, field: string): Address => {
  if (!isAddress(value, { strict: false })) throw new Error(`Invalid ${field}`);
  return value as Address;
};

/**
 * The hash the user is about to sign, recomputed here rather than taken from the server.
 *
 * Throws unless the prepared Safe transaction is exactly what the screen shows: from the
 * user's own Safe, a plain transfer of the whole `amount` of that token to the destination the
 * server named, with nothing refunded to anyone. A passkey signature over anything else could
 * move the user's funds elsewhere, so this is checked before the passkey prompt opens.
 *
 * It is also bound to the card the user tapped (`approved`): same network, same token, same
 * amount. A different amount throws {@link SafeRecoveryAmountChangedError} so the user sees and
 * approves the new one rather than signing it unseen.
 */
export const verifiedSafeRecoveryHash = (
  prepared: SafeRecoveryPrepared,
  userSafeAddress: string,
  approved: ApprovedSafeRecovery,
): Hex => {
  const safe = asAddress(prepared.safeAddress, 'Safe address');
  const token = asAddress(prepared.tokenAddress, 'token address');
  const destination = asAddress(prepared.destinationAddress, 'destination');
  const { safeTx } = prepared;

  if (!isAddressEqual(safe, asAddress(userSafeAddress, 'wallet address'))) {
    throw new Error('This transfer is not from your Solid wallet');
  }
  if (
    prepared.chainId !== approved.chainId ||
    !isAddressEqual(token, asAddress(approved.tokenAddress, 'approved token'))
  ) {
    throw new Error('This transfer is not for the token shown');
  }
  if (BigInt(prepared.amount) !== BigInt(approved.amount)) {
    throw new SafeRecoveryAmountChangedError(prepared.amount);
  }
  if (!isAddressEqual(asAddress(safeTx.to, 'transaction target'), token)) {
    throw new Error('This transfer does not move the token shown');
  }
  if (
    BigInt(safeTx.value) !== 0n ||
    safeTx.operation !== 0 ||
    BigInt(safeTx.safeTxGas) !== 0n ||
    BigInt(safeTx.baseGas) !== 0n ||
    BigInt(safeTx.gasPrice) !== 0n ||
    !isAddressEqual(asAddress(safeTx.gasToken, 'gas token'), zeroAddress) ||
    !isAddressEqual(asAddress(safeTx.refundReceiver, 'refund receiver'), zeroAddress)
  ) {
    throw new Error('This transfer has unexpected terms');
  }

  const call = decodeFunctionData({ abi: erc20Abi, data: safeTx.data as Hex });
  if (call.functionName !== 'transfer') {
    throw new Error('This is not a transfer');
  }
  const [recipient, amount] = call.args as readonly [Address, bigint];
  if (!isAddressEqual(recipient, destination) || amount !== BigInt(prepared.amount)) {
    throw new Error('This transfer does not match what is shown');
  }

  const hash = hashTypedData({
    domain: { chainId: prepared.chainId, verifyingContract: safe },
    types: SAFE_TX_TYPES,
    primaryType: 'SafeTx',
    message: {
      to: token,
      value: 0n,
      data: safeTx.data as Hex,
      operation: 0,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: zeroAddress,
      refundReceiver: zeroAddress,
      nonce: BigInt(safeTx.nonce),
    },
  });
  if (hash.toLowerCase() !== prepared.safeTxHash.toLowerCase()) {
    throw new Error('This transfer could not be verified');
  }
  return hash;
};

const RECOVERY_STATUSES: readonly SafeRecoveryStatus[] = [
  'awaiting_signature',
  'submitting',
  'submitted',
  'succeeded',
  'failed',
  'expired',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isBaseUnits = (value: unknown): value is string =>
  typeof value === 'string' && /^\d+$/.test(value);
const isChainId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;
const isDecimals = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 36;

/**
 * The amount as shown, always worked out here from the base units the user approves, never
 * taken from the server's display string: what the card shows is what gets signed.
 */
const displayAmount = (amount: string, decimals: number) => formatUnits(BigInt(amount), decimals);
const isAddressText = (value: unknown): value is string =>
  typeof value === 'string' && isAddress(value, { strict: false });

const invalid = (what: string): never => {
  throw new Error(`Unexpected ${what} from the server`);
};

/** A recovery from the server, checked field by field: the screen and the poll read these. */
export const parseSafeRecovery = (value: unknown): SafeRecovery => {
  if (
    !isRecord(value) ||
    !isText(value.id) ||
    !isChainId(value.chainId) ||
    !isText(value.network) ||
    !isAddressText(value.tokenAddress) ||
    !isText(value.symbol) ||
    !isBaseUnits(value.amount) ||
    !isDecimals(value.decimals) ||
    !RECOVERY_STATUSES.includes(value.status as SafeRecoveryStatus) ||
    (value.transactionHash !== undefined && !isText(value.transactionHash)) ||
    (value.explorerUrl !== undefined && !isText(value.explorerUrl)) ||
    (value.error !== undefined && typeof value.error !== 'string')
  ) {
    return invalid('recovery');
  }
  return {
    ...(value as unknown as SafeRecovery),
    amountFormatted: displayAmount(value.amount, value.decimals),
  };
};

/**
 * `GET /safe-recovery/balances`, checked before any of it reaches the screen: a malformed entry
 * becomes a query error rather than a crash while rendering.
 */
export const parseSafeRecoveryBalances = (value: unknown): SafeRecoveryBalancesResponse => {
  if (!isRecord(value) || typeof value.enabled !== 'boolean' || !Array.isArray(value.items)) {
    return invalid('balances');
  }
  const items = value.items.map(item => {
    if (
      !isRecord(item) ||
      !isChainId(item.chainId) ||
      !isText(item.network) ||
      !isAddressText(item.safeAddress) ||
      !isAddressText(item.tokenAddress) ||
      !isText(item.symbol) ||
      !isBaseUnits(item.amount) ||
      !isDecimals(item.decimals)
    ) {
      return invalid('balance');
    }
    return {
      ...(item as unknown as SafeRecoveryBalance),
      amountFormatted: displayAmount(item.amount, item.decimals),
      ...(item.recovery !== undefined ? { recovery: parseSafeRecovery(item.recovery) } : {}),
    };
  });
  return { enabled: value.enabled, items };
};
