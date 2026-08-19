import { VaultType } from '@/lib/types';

/**
 * Narrows a `?vault=` query value to a vault we actually have.
 *
 * The rewards "Add FUSE to your savings" CTA deep-links to
 * `/savings?vault=fuse`. The param is user-controllable, so anything that isn't
 * a real vault has to fall through to the default rather than seeding screen
 * state with a value nothing can render.
 */
export const isVaultType = (value: string | undefined): value is VaultType =>
  Object.values(VaultType).includes(value as VaultType);
