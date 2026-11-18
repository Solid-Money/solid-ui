import { serializeSignature } from 'viem';

import type { Hex } from 'viem';

/**
 * A Turnkey raw-payload signature as the 65-byte hex a Safe owner signature is.
 *
 * The same encoding `@turnkey/viem` produces for a single `sign({ hash })`: Turnkey's `v` is the
 * recovery parity ("00" / "01"), written as 27 / 28. Anything else is not a signature this code
 * has seen Turnkey return, and is refused rather than guessed at.
 */
export function serializeTurnkeySignature({ r, s, v }: { r: string; s: string; v: string }): Hex {
  const parity = BigInt(v);
  if (parity !== 0n && parity !== 1n) throw new Error(`Unexpected signature parity: ${v}`);
  return serializeSignature({
    r: `0x${r}` as Hex,
    s: `0x${s}` as Hex,
    yParity: parity === 0n ? 0 : 1,
  });
}

/**
 * One signer's place in a {@link PasskeySignatureBatch}.
 *
 * `sign` is what a Safe owner account's `sign({ hash })` calls. `release` must be called when the
 * signer is done — signed or not — so a signer that bows out early (nothing left to sign, an error
 * before signing, a cancelled fee prompt) never leaves the others waiting for its hash.
 */
export interface PasskeyBatchParticipant {
  sign: (hash: Hex) => Promise<Hex>;
  release: () => void;
}

export interface PasskeySignatureBatch {
  /** A place in the batch. Take one per signer, before any of them starts preparing. */
  participant: () => PasskeyBatchParticipant;
}

export interface PasskeySignatureBatchOptions {
  /** Signs every hash in one passkey request; resolves the signatures in the same order. */
  signAll: (hashes: Hex[]) => Promise<Hex[]>;
  /**
   * The longest the first hash waits for the others. A signer can stall before signing (a slow
   * gas estimate, a fee prompt the user is reading), and the user should not stare at a spinner
   * with no passkey prompt while it does: past this, what has arrived is signed, and anything
   * later signs on its own.
   */
  flushAfterMs?: number;
}

const DEFAULT_FLUSH_AFTER_MS = 20_000;

interface Pending {
  hash: Hex;
  resolve: (signature: Hex) => void;
  reject: (error: unknown) => void;
}

/**
 * Collects the hashes several user operations need signed, and signs them with ONE passkey
 * prompt.
 *
 * Activating a Wirex card with euro needs two approvals on two chains — the card module on Fuse
 * and the EURC module on Base — and each was its own passkey prompt. Both are signatures by the
 * same Safe owner, so they can be one Turnkey `signRawPayloads` request: one passkey assertion
 * over exactly these hashes. No session key, no standing credential: every signature is still
 * approved by the passkey, the user just approves both at once.
 *
 * The batch fires as soon as every participant that will sign has, and a participant that will
 * not sign releases its place instead. Past that, signing falls back to one prompt per hash, so
 * the batch can delay a signature but never lose one.
 */
export function createPasskeySignatureBatch({
  signAll,
  flushAfterMs = DEFAULT_FLUSH_AFTER_MS,
}: PasskeySignatureBatchOptions): PasskeySignatureBatch {
  let expected = 0;
  let flushed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const queue: Pending[] = [];

  const flush = () => {
    if (flushed) return;
    flushed = true;
    if (timer) clearTimeout(timer);
    timer = null;

    const items = queue.splice(0);
    if (items.length === 0) return;

    signAll(items.map(item => item.hash)).then(
      signatures => {
        if (signatures.length !== items.length) {
          const error = new Error(
            `Expected ${items.length} signatures from the passkey request, got ${signatures.length}`,
          );
          items.forEach(item => item.reject(error));
          return;
        }
        items.forEach((item, index) => item.resolve(signatures[index]));
      },
      error => items.forEach(item => item.reject(error)),
    );
  };

  const maybeFlush = () => {
    if (!flushed && queue.length > 0 && queue.length >= expected) flush();
  };

  return {
    participant: () => {
      expected += 1;
      let submitted = false;
      let released = false;

      return {
        sign: (hash: Hex) => {
          // Too late to ride along: signed on its own, as it would have been without a batch.
          if (flushed || released) return signAll([hash]).then(([signature]) => signature);

          submitted = true;
          return new Promise<Hex>((resolve, reject) => {
            queue.push({ hash, resolve, reject });
            if (!timer) timer = setTimeout(flush, flushAfterMs);
            maybeFlush();
          });
        },
        release: () => {
          if (released) return;
          released = true;
          // A participant that signed has its hash in the queue already; only one that never
          // got that far gives its place back.
          if (!submitted) {
            expected -= 1;
            maybeFlush();
          }
        },
      };
    },
  };
}
