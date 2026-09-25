/**
 * The slice of `SolidSubscriptionModule` (boring-vault `src/solid-rewards/`)
 * the app uses.
 *
 * `subscribe` is the mandate: it says how much may be taken from this Safe, and
 * how rarely. It is signed once, batched with the `enableModule` that makes the
 * module usable, so one signature both grants the permission and bounds it.
 *
 * Note what the *charge* side does not take, and therefore what this signature
 * cannot be turned into: the destination and the asset are immutable on the
 * contract, so the only thing Solid can ever do with this permission is move up
 * to `maxAmountPerPeriod` of USDC to the revenue treasury, no more often than
 * `periodSeconds`. `cancel` withdraws it; `Safe.disableModule` withdraws it
 * harder, and the Safe enforces that itself on the next block.
 */
export const SolidSubscriptionModule_ABI = [
  {
    inputs: [
      { internalType: 'uint128', name: 'maxAmountPerPeriod', type: 'uint128' },
      { internalType: 'uint64', name: 'periodSeconds', type: 'uint64' },
    ],
    name: 'subscribe',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'cancel',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'resume',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'safe', type: 'address' }],
    name: 'subscriptionOf',
    outputs: [
      {
        components: [
          { internalType: 'bool', name: 'registered', type: 'bool' },
          { internalType: 'bool', name: 'paused', type: 'bool' },
          { internalType: 'uint128', name: 'maxAmountPerPeriod', type: 'uint128' },
          { internalType: 'uint64', name: 'periodSeconds', type: 'uint64' },
          { internalType: 'uint64', name: 'subscribedAt', type: 'uint64' },
          { internalType: 'uint64', name: 'lastChargedAt', type: 'uint64' },
          { internalType: 'uint64', name: 'cancelledAt', type: 'uint64' },
        ],
        internalType: 'struct SolidSubscriptionModule.Subscription',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'safe', type: 'address' }],
    name: 'isModuleEnabledOn',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'safe', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'canCharge',
    outputs: [
      { internalType: 'bool', name: '', type: 'bool' },
      { internalType: 'string', name: '', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'maxChargeAmount',
    outputs: [{ internalType: 'uint128', name: '', type: 'uint128' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
