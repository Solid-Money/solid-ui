/**
 * `SolidSpendLens` — the cohort-aware, one-`eth_call` read of a Safe's whole spend state.
 *
 * **Generated from the compiled artifact, not hand-written.** See the note in
 * `SolidCashModuleV2.ts`.
 *
 * Serves v1 and v2 Safes from one call and reports which module owns the Safe, so the app
 * asks a single question — "what can this Safe spend, and how?" — instead of branching on
 * the module before it knows which one is live. `cohort` is what that branch reads.
 */
export const SolidSpendLens_ABI = [
  {
    type: 'function',
    name: 'COHORT_BOTH',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'COHORT_NONE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'COHORT_V1',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'COHORT_V2',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'availableToSpend',
    inputs: [
      {
        name: 'safe',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct UnifiedAvailability',
        components: [
          {
            name: 'cohort',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'moduleEnabled',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'registered',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'modulePaused',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'safePausedFlag',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'limitsWaived',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'activeMode',
            type: 'uint8',
            internalType: 'enum Mode',
          },
          {
            name: 'incomingMode',
            type: 'uint8',
            internalType: 'enum Mode',
          },
          {
            name: 'incomingModeStartTime',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'debit',
            type: 'tuple',
            internalType: 'struct DebitAvailability',
            components: [
              {
                name: 'spendableUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'limitRemainingUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'maxPerTxUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'anyPriceUnusable',
                type: 'bool',
                internalType: 'bool',
              },
              {
                name: 'perToken',
                type: 'tuple[]',
                internalType: 'struct TokenAvailability[]',
                components: [
                  {
                    name: 'token',
                    type: 'address',
                    internalType: 'address',
                  },
                  {
                    name: 'amount',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                  {
                    name: 'priceUsd',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                  {
                    name: 'priceUsable',
                    type: 'bool',
                    internalType: 'bool',
                  },
                  {
                    name: 'valueUsd',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                ],
              },
            ],
          },
          {
            name: 'credit',
            type: 'tuple',
            internalType: 'struct CreditAvailability',
            components: [
              {
                name: 'collateralUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'borrowingPowerUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'liquidationCapacityUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'debtUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'healthFactorWad',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'availableToBorrowUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'prospectiveCollateralUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'fullyPriced',
                type: 'bool',
                internalType: 'bool',
              },
              {
                name: 'liquidatable',
                type: 'bool',
                internalType: 'bool',
              },
              {
                name: 'unhealthySince',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'perCollateral',
                type: 'tuple[]',
                internalType: 'struct TokenAvailability[]',
                components: [
                  {
                    name: 'token',
                    type: 'address',
                    internalType: 'address',
                  },
                  {
                    name: 'amount',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                  {
                    name: 'priceUsd',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                  {
                    name: 'priceUsable',
                    type: 'bool',
                    internalType: 'bool',
                  },
                  {
                    name: 'valueUsd',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                ],
              },
            ],
          },
          {
            name: 'limit',
            type: 'tuple',
            internalType: 'struct SpendingLimit',
            components: [
              {
                name: 'dailyLimit',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'monthlyLimit',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'spentToday',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'spentThisMonth',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'pendingDailyLimit',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'pendingMonthlyLimit',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'dailyRenewalTimestamp',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'monthlyRenewalTimestamp',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'dailyLimitActivationTime',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'monthlyLimitActivationTime',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'timezoneOffset',
                type: 'int256',
                internalType: 'int256',
              },
            ],
          },
          {
            name: 'blockNumber',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'blockTimestamp',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'availableToSpendWith',
    inputs: [
      {
        name: 'safe',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'tokens',
        type: 'address[]',
        internalType: 'address[]',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct UnifiedAvailability',
        components: [
          {
            name: 'cohort',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'moduleEnabled',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'registered',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'modulePaused',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'safePausedFlag',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'limitsWaived',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'activeMode',
            type: 'uint8',
            internalType: 'enum Mode',
          },
          {
            name: 'incomingMode',
            type: 'uint8',
            internalType: 'enum Mode',
          },
          {
            name: 'incomingModeStartTime',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'debit',
            type: 'tuple',
            internalType: 'struct DebitAvailability',
            components: [
              {
                name: 'spendableUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'limitRemainingUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'maxPerTxUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'anyPriceUnusable',
                type: 'bool',
                internalType: 'bool',
              },
              {
                name: 'perToken',
                type: 'tuple[]',
                internalType: 'struct TokenAvailability[]',
                components: [
                  {
                    name: 'token',
                    type: 'address',
                    internalType: 'address',
                  },
                  {
                    name: 'amount',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                  {
                    name: 'priceUsd',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                  {
                    name: 'priceUsable',
                    type: 'bool',
                    internalType: 'bool',
                  },
                  {
                    name: 'valueUsd',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                ],
              },
            ],
          },
          {
            name: 'credit',
            type: 'tuple',
            internalType: 'struct CreditAvailability',
            components: [
              {
                name: 'collateralUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'borrowingPowerUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'liquidationCapacityUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'debtUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'healthFactorWad',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'availableToBorrowUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'prospectiveCollateralUsd',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'fullyPriced',
                type: 'bool',
                internalType: 'bool',
              },
              {
                name: 'liquidatable',
                type: 'bool',
                internalType: 'bool',
              },
              {
                name: 'unhealthySince',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'perCollateral',
                type: 'tuple[]',
                internalType: 'struct TokenAvailability[]',
                components: [
                  {
                    name: 'token',
                    type: 'address',
                    internalType: 'address',
                  },
                  {
                    name: 'amount',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                  {
                    name: 'priceUsd',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                  {
                    name: 'priceUsable',
                    type: 'bool',
                    internalType: 'bool',
                  },
                  {
                    name: 'valueUsd',
                    type: 'uint256',
                    internalType: 'uint256',
                  },
                ],
              },
            ],
          },
          {
            name: 'limit',
            type: 'tuple',
            internalType: 'struct SpendingLimit',
            components: [
              {
                name: 'dailyLimit',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'monthlyLimit',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'spentToday',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'spentThisMonth',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'pendingDailyLimit',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'pendingMonthlyLimit',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'dailyRenewalTimestamp',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'monthlyRenewalTimestamp',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'dailyLimitActivationTime',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'monthlyLimitActivationTime',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'timezoneOffset',
                type: 'int256',
                internalType: 'int256',
              },
            ],
          },
          {
            name: 'blockNumber',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'blockTimestamp',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cohortOf',
    inputs: [
      {
        name: 'safe',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
] as const;
