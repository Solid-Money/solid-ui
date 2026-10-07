import { Hex, parseErc6492Signature } from 'viem';

/**
 * The plain ERC-1271 signature inside a smart-account signature.
 *
 * viem wraps a smart account's signature in ERC-6492 (factory + init calldata +
 * the real signature + a magic suffix) whenever it believes the account is not
 * deployed yet, so a verifier can deploy it counterfactually. A verifier that
 * only speaks ERC-1271 — Rain's collateral coordinator checks admin signatures
 * with `SignatureChecker` — hands that whole blob to the Safe's
 * `isValidSignature`, which rejects it, and the call reverts with
 * `InvalidSignature()` (0x8baa579f). Only unwrap for such a verifier, and only
 * once the account is deployed: the inner signature cannot be checked against
 * an account that has no code.
 *
 * A signature that is not ERC-6492 comes back unchanged.
 */
export const toErc1271Signature = (signature: Hex): Hex =>
  parseErc6492Signature(signature).signature;

/** Thrown when the account still reads as undeployed after every attempt. */
export class SmartAccountNotDeployedError extends Error {
  constructor() {
    super('Your wallet is still being set up on this network. Please try again in a moment.');
    this.name = 'SmartAccountNotDeployedError';
  }
}

/**
 * Wait until the account itself reports that it is deployed.
 *
 * A bundler returns a deployment receipt as soon as its own node has the block,
 * and the app's RPC can keep answering `getCode` with "0x" for a little longer.
 * Until the account sees code it treats itself as counterfactual: it wraps
 * every signature in ERC-6492 and puts the factory back into the next user
 * operation, which the EntryPoint rejects for an account that already exists.
 * viem's `isDeployed()` remembers its first `true`, so once this resolves the
 * same account instance signs and sends as a deployed account.
 */
export const waitForSmartAccountDeployment = async (
  account: { isDeployed: () => Promise<boolean> },
  { attempts = 10, intervalMs = 1_000 }: { attempts?: number; intervalMs?: number } = {},
): Promise<void> => {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (await account.isDeployed()) return;
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new SmartAccountNotDeployedError();
};
