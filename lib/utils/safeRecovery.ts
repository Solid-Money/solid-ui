import {
  decodeFunctionData,
  erc20Abi,
  hashTypedData,
  isAddress,
  isAddressEqual,
  zeroAddress,
} from 'viem';

import type { SafeRecoveryPrepared } from '@/lib/types';
import type { Address, Hex } from 'viem';

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
 */
export const verifiedSafeRecoveryHash = (
  prepared: SafeRecoveryPrepared,
  userSafeAddress: string,
): Hex => {
  const safe = asAddress(prepared.safeAddress, 'Safe address');
  const token = asAddress(prepared.tokenAddress, 'token address');
  const destination = asAddress(prepared.destinationAddress, 'destination');
  const { safeTx } = prepared;

  if (!isAddressEqual(safe, asAddress(userSafeAddress, 'wallet address'))) {
    throw new Error('This transfer is not from your Solid wallet');
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
