import { Vault, VaultType } from '@/lib/types';
import { LIVE_VAULTS } from '@/lib/vaults';

/**
 * Narrows a `?vault=` query value to a vault we actually have.
 *
 * The rewards "Add FUSE to your savings" CTA deep-links to
 * `/savings?vault=fuse`. The param is user-controllable, so anything that isn't
 * a real vault has to fall through to the default rather than seeding screen
 * state with a value nothing can render.
 *
 * "A vault we have" means one this build lists, not merely a `VaultType`:
 * soEURC is a type in every build but listed on QA/preview only, so
 * `/savings?vault=eur` in production falls through to the USD vault instead of
 * rendering a vault that does not exist there.
 */
export const isVaultType = (
  value: string | undefined,
  vaults: readonly Pick<Vault, 'type'>[] = LIVE_VAULTS,
): value is VaultType => !!value && vaults.some(vault => vault.type === value);
