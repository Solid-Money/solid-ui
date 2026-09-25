import { Address, encodeFunctionData, isAddress } from 'viem';

import { Safe_ABI } from '@/lib/abis/Safe';

/**
 * Head of a Safe's module linked list. `disableModule(prevModule, module)` needs the
 * entry pointing at the one being removed, and for the most recently enabled module
 * that pointer is the sentinel itself rather than another module's address.
 */
export const SENTINEL_MODULES = '0x0000000000000000000000000000000000000001' as Address;

/**
 * `disableModule` calls for each of `targets` present in `modules`, in batch order.
 *
 * `modules` is the Safe's list as `getModulesPaginated` returns it, walking outwards from the
 * sentinel. Predecessors are worked out against the list as the calls before them leave it, not
 * against that one snapshot: removing a module re-points its predecessor at its successor, so two
 * neighbours read off the same snapshot would give the second call a pointer to a module that is
 * already gone — GS103, and the whole batch with it.
 *
 * `disabled` names what the calls remove, so a caller that needs one of them can tell "already
 * off" from "could not find it".
 */
export const buildModuleDisables = (
  safeAddress: Address,
  modules: readonly Address[],
  targets: readonly Address[],
): { disabled: Address[]; transactions: { to: Address; data: `0x${string}` }[] } => {
  const remaining = [...modules];
  const disabled: Address[] = [];
  const transactions: { to: Address; data: `0x${string}` }[] = [];

  for (const target of targets) {
    const index = remaining.findIndex(entry => entry.toLowerCase() === target.toLowerCase());
    if (index === -1) continue;

    transactions.push({
      to: safeAddress,
      data: encodeFunctionData({
        abi: Safe_ABI,
        functionName: 'disableModule',
        args: [index === 0 ? SENTINEL_MODULES : remaining[index - 1], remaining[index]],
      }),
    });
    disabled.push(remaining[index]);
    remaining.splice(index, 1);
  }

  return { disabled, transactions };
};

/** Whether `modules` includes `target`, ignoring checksum case. */
export const includesModule = (modules: readonly Address[], target: Address) =>
  modules.some(entry => entry.toLowerCase() === target.toLowerCase());

/**
 * The Fuse v2 core replaced by the 2026-09-24 redeploy. Safes kept being moved onto it by builds
 * that still carried its address, so it is the default rather than something every environment has
 * to remember to set.
 */
export const RETIRED_FUSE_CASH_MODULE_V2 = '0xE2d4FB3d1eeD6Bdc3fD62A93ab35A33FC3c97b2B' as Address;

/**
 * The retired v2 cores to clean off a Safe: a comma-separated env list, or the known one when unset.
 *
 * The live core is always dropped from the list. A build whose env names its own module as retired
 * would otherwise disable, in the same batch, the module it is about to register on.
 */
export const parseRetiredCashModulesV2 = (
  configured: string | undefined,
  current: string | undefined,
): Address[] =>
  (configured?.trim() ? configured : RETIRED_FUSE_CASH_MODULE_V2)
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => isAddress(entry, { strict: false }))
    .filter(entry => entry.toLowerCase() !== current?.trim().toLowerCase()) as Address[];
