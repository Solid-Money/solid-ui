/**
 * The slice of `SolidUsageBillingModule` (boring-vault `src/solid-billing/`),
 * on Base, that the app uses — the AI API's billing module.
 *
 * `subscribe` is the mandate: how many dollars (micro-USD, 6 decimals) may be
 * taken from this Safe in one charge, and how rarely. Signed once, batched with
 * the `enableModule` that makes the module usable, so one passkey prompt both
 * grants the permission and bounds it — for every token the module draws from,
 * USDC first and then soUSD, including any added later.
 *
 * The destination is immutable on the contract, so the only thing Solid can
 * ever do with this permission is move up to `maxAmountPerPeriod` dollars to
 * the revenue treasury, no more often than `periodSeconds`. `cancel` withdraws
 * it; `Safe.disableModule` withdraws it harder.
 */
export const SolidUsageBillingModule_ABI = [
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
] as const;
