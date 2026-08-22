/**
 * `SolidCashModule` — the Safe module Solid's card backend debits soUSD through.
 *
 * Only the surface the app needs: opting a Safe in, reading whether it is opted in,
 * and reading the caps that bound what the module may take. The app never calls
 * `spend` — that is the backend's SPENDER_ROLE key, and the destination is immutable
 * in the contract, so the app has nothing to authorize about it.
 *
 * `registerSafe` must be called *by the Safe itself*, which is why it is batched with
 * `Safe.enableModule` into a single user operation: both run with `msg.sender` set to
 * the Safe, and owner consent is structural rather than something the contract checks.
 */
export const SolidCashModule_ABI = [
  {
    // Opts the calling Safe into card spending. Pass 0 for either limit to take the
    // org default. `timezoneOffset` is seconds from UTC and fixes when the rolling
    // daily/monthly windows reset — it cannot be changed afterwards.
    inputs: [
      { internalType: 'uint256', name: 'dailyLimitUsd', type: 'uint256' },
      { internalType: 'uint256', name: 'monthlyLimitUsd', type: 'uint256' },
      { internalType: 'int256', name: 'timezoneOffset', type: 'int256' },
    ],
    name: 'registerSafe',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'safe', type: 'address' }],
    name: 'isRegistered',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    // Reported as false for any address that cannot answer, including a Safe that is
    // not deployed yet — so this never reverts the read.
    inputs: [{ internalType: 'address', name: 'safe', type: 'address' }],
    name: 'isModuleEnabledOn',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    // Live org-wide ceilings. They clamp every Safe on every read, so a Safe cannot
    // register above them and lowering one applies to already-registered Safes.
    inputs: [],
    name: 'maxDailyLimitUsd',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'maxMonthlyLimitUsd',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'defaultDailyLimitUsd',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'defaultMonthlyLimitUsd',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    // Hard cap on any single card transaction, independent of the rolling windows.
    inputs: [],
    name: 'maxPerTxUsd',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'isPaused',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'safe', type: 'address' }],
    name: 'safePaused',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    // Delay before a requested limit *increase* takes effect. Decreases are immediate;
    // the asymmetry is deliberate — raising a cap widens what a compromised backend
    // key could take, so it is the direction that must never be instant.
    inputs: [],
    name: 'limitRaiseDelay',
    outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'dailyLimitUsd', type: 'uint256' },
      { internalType: 'uint256', name: 'monthlyLimitUsd', type: 'uint256' },
    ],
    name: 'decreaseSpendingLimit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'dailyLimitUsd', type: 'uint256' },
      { internalType: 'uint256', name: 'monthlyLimitUsd', type: 'uint256' },
    ],
    name: 'requestSpendingLimitIncrease',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
