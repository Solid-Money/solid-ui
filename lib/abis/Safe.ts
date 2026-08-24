/**
 * The slice of Safe 1.4.1 the app needs to manage modules on the user's own account.
 *
 * `enableModule` is `authorized`, meaning `msg.sender` must be the Safe itself — so it
 * is only reachable as a transaction the Safe executes against its own address, which
 * is exactly what a user operation from the Safe smart account does.
 *
 * Enabling a module is a grant of standing permission over the Safe's tokens, and
 * `disableModule` is how a user withdraws it. The card module re-checks
 * `isModuleEnabled` on every debit, so disabling stops spending immediately rather
 * than at the next backend poll.
 */
export const Safe_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'module', type: 'address' }],
    name: 'enableModule',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    // `prevModule` is the entry pointing at `module` in the Safe's linked list, or
    // SENTINEL (0x…01) when it is first. Read it from `getModulesPaginated` rather
    // than assumed.
    inputs: [
      { internalType: 'address', name: 'prevModule', type: 'address' },
      { internalType: 'address', name: 'module', type: 'address' },
    ],
    name: 'disableModule',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'module', type: 'address' }],
    name: 'isModuleEnabled',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'start', type: 'address' },
      { internalType: 'uint256', name: 'pageSize', type: 'uint256' },
    ],
    name: 'getModulesPaginated',
    outputs: [
      { internalType: 'address[]', name: 'array', type: 'address[]' },
      { internalType: 'address', name: 'next', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
