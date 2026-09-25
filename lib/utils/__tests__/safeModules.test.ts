import { Address, decodeFunctionData, getAddress } from 'viem';

import { Safe_ABI } from '@/lib/abis/Safe';
import {
  buildModuleDisables,
  includesModule,
  parseRetiredCashModulesV2,
  RETIRED_FUSE_CASH_MODULE_V2,
  SENTINEL_MODULES,
} from '@/lib/utils/safeModules';

/**
 * The shape of a real stranded Safe (Fuse, 2026-09-25): the migration batch disabled v1 and
 * enabled the retired v2 core, which went to the head of the list ahead of the 4337 module.
 */
const SAFE = getAddress('0xebaf1edf7164c9ecd5b8698e6bda9636ae09eabc');
const V1 = getAddress('0x31F7f64769C6B2D4d3edd053421a0465FB371061');
const RETIRED_V2 = getAddress('0xE2d4FB3d1eeD6Bdc3fD62A93ab35A33FC3c97b2B');
const LIVE_V2 = getAddress('0xa98f2D4b79A465B265F68F745f5048BC369DA999');
const SAFE_4337 = getAddress('0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226');

/** `[prevModule, module]` of each `disableModule` call, in batch order. */
const disableArgs = (transactions: { to: Address; data: `0x${string}` }[]) =>
  transactions.map(({ to, data }) => {
    expect(to).toBe(SAFE);
    const decoded = decodeFunctionData({ abi: Safe_ABI, data });
    expect(decoded.functionName).toBe('disableModule');
    return decoded.args;
  });

describe('buildModuleDisables', () => {
  it('disables the retired core on a stranded Safe and skips v1, which is already off', () => {
    const { disabled, transactions } = buildModuleDisables(
      SAFE,
      [RETIRED_V2, SAFE_4337],
      [V1, RETIRED_V2],
    );

    expect(disabled).toEqual([RETIRED_V2]);
    expect(disableArgs(transactions)).toEqual([[SENTINEL_MODULES, RETIRED_V2]]);
  });

  it('points at the list as earlier calls leave it when the targets are neighbours', () => {
    // sentinel -> RETIRED_V2 -> V1 -> 4337. Removing RETIRED_V2 first re-points the sentinel
    // at V1, so V1's predecessor is the sentinel — not RETIRED_V2, which a single snapshot says.
    const { transactions } = buildModuleDisables(
      SAFE,
      [RETIRED_V2, V1, SAFE_4337],
      [RETIRED_V2, V1],
    );

    expect(disableArgs(transactions)).toEqual([
      [SENTINEL_MODULES, RETIRED_V2],
      [SENTINEL_MODULES, V1],
    ]);
  });

  it('uses the neighbour that is still there when the later module goes first', () => {
    const { transactions } = buildModuleDisables(
      SAFE,
      [RETIRED_V2, V1, SAFE_4337],
      [V1, RETIRED_V2],
    );

    expect(disableArgs(transactions)).toEqual([
      [RETIRED_V2, V1],
      [SENTINEL_MODULES, RETIRED_V2],
    ]);
  });

  it('removes a module deeper in the list from its actual predecessor', () => {
    const { transactions } = buildModuleDisables(
      SAFE,
      [LIVE_V2, SAFE_4337, RETIRED_V2],
      [RETIRED_V2],
    );

    expect(disableArgs(transactions)).toEqual([[SAFE_4337, RETIRED_V2]]);
  });

  it('matches regardless of checksum case and reports the address as the Safe lists it', () => {
    const { disabled, transactions } = buildModuleDisables(
      SAFE,
      [RETIRED_V2, SAFE_4337],
      [RETIRED_V2.toLowerCase() as Address],
    );

    expect(disabled).toEqual([RETIRED_V2]);
    expect(disableArgs(transactions)).toEqual([[SENTINEL_MODULES, RETIRED_V2]]);
  });

  it('sends nothing when none of the targets are enabled', () => {
    expect(buildModuleDisables(SAFE, [LIVE_V2, SAFE_4337], [V1, RETIRED_V2])).toEqual({
      disabled: [],
      transactions: [],
    });
  });

  it('leaves the list it was given untouched', () => {
    const modules = [RETIRED_V2, V1, SAFE_4337];
    buildModuleDisables(SAFE, modules, [RETIRED_V2, V1]);

    expect(modules).toEqual([RETIRED_V2, V1, SAFE_4337]);
  });
});

describe('includesModule', () => {
  it('ignores checksum case', () => {
    expect(includesModule([V1], V1.toLowerCase() as Address)).toBe(true);
    expect(includesModule([RETIRED_V2], V1)).toBe(false);
  });
});

describe('parseRetiredCashModulesV2', () => {
  it('defaults to the 2026-09-24 retiree when unset or blank', () => {
    expect(parseRetiredCashModulesV2(undefined, LIVE_V2)).toEqual([RETIRED_FUSE_CASH_MODULE_V2]);
    // Helm and EAS render an unset key as an empty string, not as absent.
    expect(parseRetiredCashModulesV2('  ', LIVE_V2)).toEqual([RETIRED_FUSE_CASH_MODULE_V2]);
  });

  it('reads a comma-separated list and drops entries that are not addresses', () => {
    const other = getAddress('0x34c3564C4EBC29f90B4DD200509880C40Fd26E32');

    expect(parseRetiredCashModulesV2(` ${RETIRED_V2} , nope,,${other}`, LIVE_V2)).toEqual([
      RETIRED_V2,
      other,
    ]);
  });

  it('never lists the live core, whatever the env says', () => {
    expect(
      parseRetiredCashModulesV2(`${RETIRED_V2},${LIVE_V2.toLowerCase()}`, ` ${LIVE_V2} `),
    ).toEqual([RETIRED_V2]);
    // A build still pointed at the retiree must not disable the module it registers on.
    expect(parseRetiredCashModulesV2(undefined, RETIRED_V2)).toEqual([]);
  });
});
