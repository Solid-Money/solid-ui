import * as Crypto from 'expo-crypto';

/**
 * 32 lowercase hex characters: a UUIDv4 without dashes. The shape of a
 * GlitchTip/Sentry event ID and of the backend's `X-Request-Id`, which is what
 * lets one value be both.
 */
const HEX_32 = /^[0-9a-f]{32}$/;

export const isHex32 = (value: unknown): value is string =>
  typeof value === 'string' && HEX_32.test(value);

/** A fresh event ID, for failures that never reached our backend. */
export const newEventId = (): string => Crypto.randomUUID().replace(/-/g, '').toLowerCase();

/**
 * The short Ref a user sees and reads out to support: the first 8 characters
 * of the event ID, uppercased and split in two (`9c1b4f2a…` → `9C1B-4F2A`).
 *
 * When the failure came from one of our endpoints the event ID *is* the
 * request ID, so the Ref is also a prefix of every backend log line the request
 * wrote (`rid=9c1b4f2a…`). Eight hex characters are not globally unique over
 * months; they don't need to be, because support always looks a Ref up next to
 * the user who sent it, and the full event ID travels with it into the chat.
 */
export const formatErrorRef = (eventId: string): string => {
  const head = eventId.slice(0, 8).toUpperCase();
  return `${head.slice(0, 4)}-${head.slice(4, 8)}`;
};

/** `Ref 9C1B-4F2A` → `9C1B4F2A`, the form the backend stores. */
export const compactErrorRef = (ref: string): string =>
  ref
    // "Ref" itself contains hex letters, so the label goes before the filter.
    .replace(/^\s*ref[\s:#]*/i, '')
    .replace(/[^0-9a-f]/gi, '')
    .toUpperCase();
