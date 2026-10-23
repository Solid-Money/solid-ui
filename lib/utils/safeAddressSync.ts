import { updateSafeAddress } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils/utils';

/** Stable codes from POST /auths/update-safe-address. */
export const SAFE_LINK_ERROR = {
  ALREADY_SET: 'SAFE_ALREADY_SET',
  LINKED_TO_OTHER_ACCOUNT: 'SAFE_LINKED_TO_OTHER_ACCOUNT',
} as const;

const SAFE_LINK_RETRY_DELAYS_MS = [2_000, 5_000];

const statusOf = (error: any): number | undefined => error?.status ?? error?.statusCode;

/**
 * Whether a failed link still leaves this account's own Safe linked. A 409 means
 * the account already has its Safe, unless another account holds it. A bare 409
 * comes from backends that predate the codes, which only sent it for a Safe the
 * account already had.
 */
export const isSafeAlreadyLinked = (error: any): boolean =>
  statusOf(error) === 409 && error?.code !== SAFE_LINK_ERROR.LINKED_TO_OTHER_ACCOUNT;

/**
 * Links the account's Safe on the backend. Resolves once it is linked, retrying
 * a verification outage (503) after each of `retryDelaysMs`; anything else, and
 * the last 503, is thrown so the caller leaves the Safe unsynced for next time.
 */
export const linkSafeAddress = async (
  safeAddress: string,
  {
    retryDelaysMs = SAFE_LINK_RETRY_DELAYS_MS,
    link = (address: string) => withRefreshToken(() => updateSafeAddress(address)),
    sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)),
  }: {
    retryDelaysMs?: number[];
    link?: (address: string) => Promise<unknown>;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<void> => {
  for (let attempt = 0; ; attempt++) {
    try {
      await link(safeAddress);
      return;
    } catch (error) {
      if (isSafeAlreadyLinked(error)) return;
      if (statusOf(error) !== 503 || attempt >= retryDelaysMs.length) throw error;
      await sleep(retryDelaysMs[attempt]);
    }
  }
};
