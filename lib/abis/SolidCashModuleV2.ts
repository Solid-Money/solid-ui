/**
 * `SolidCashModuleV2` — the card spend module's v2 surface, as the app uses it.
 *
 * **Generated from the compiled artifact, not hand-written.** Regenerate rather than edit:
 * the credit half of this module is arithmetic the app quotes to users, and a tuple
 * transcribed one field out of order decodes silently into wrong money.
 *
 * Core and setters are two contracts under EIP-170 but ONE address to callers — the core
 * `delegatecall`s anything it does not implement into the setters half, and reads resolve
 * through that fallback under `staticcall` exactly as writes do. So `applicableSpendingLimit`,
 * `getParams` and `getIncomingMode` live in the setters and are still called on the core's
 * address, which is what `ADDRESSES.fuse.cashModuleV2` holds.
 */
export const SolidCashModuleV2_ABI = [
  {
    type: 'function',
    name: 'allowedTokens',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address[]',
        internalType: 'address[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'borrowApyPerSecond',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cancelPendingSpendingLimitIncrease',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'collateralOf',
    inputs: [
      {
        name: 'safe',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalDebtUsd',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'debtUsd',
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
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decreaseSpendingLimit',
    inputs: [
      {
        name: 'dailyLimitUsd',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'monthlyLimitUsd',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deregisterSafe',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getMode',
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
        internalType: 'enum Mode',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'healthFactor',
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
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'incomingModeStartTime',
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
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isLegacyEnabledOn',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isModuleEnabledOn',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isPaused',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegistered',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'limitsWaived',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'maxCanSpendUsd',
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
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionValue',
    inputs: [
      {
        name: 'safe',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'powerUsd',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'capacityUsd',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'fullyPriced',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registerSafe',
    inputs: [
      {
        name: 'dailyLimitUsd',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'monthlyLimitUsd',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'timezoneOffset',
        type: 'int256',
        internalType: 'int256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'requestSpendingLimitIncrease',
    inputs: [
      {
        name: 'dailyLimitUsd',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'monthlyLimitUsd',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'safePaused',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setMode',
    inputs: [
      {
        name: 'mode',
        type: 'uint8',
        internalType: 'enum Mode',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'totalCollateral',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'applicableSpendingLimit',
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
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getIncomingMode',
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
        internalType: 'enum Mode',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getParams',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct Params',
        components: [
          {
            name: 'maxPerTxUsd',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxDailyLimitUsd',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxMonthlyLimitUsd',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'defaultDailyLimitUsd',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'defaultMonthlyLimitUsd',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxDebtPerSafeUsd',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxGlobalDebtUsd',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxForcedSpendUsd',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'dustFloorUsd',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'minPositionUsd',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'targetLtvBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'closeFactorBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'maxAdjustmentBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'modeDelay',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'limitRaiseDelay',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'collateralWithdrawDelay',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'liquidationGracePeriod',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'graceFloorHf',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'paramChangeDelay',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'limitWaiveDelay',
            type: 'uint64',
            internalType: 'uint64',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'repayFromSafe',
    inputs: [
      {
        name: 'safe',
        type: 'address',
        internalType: 'address',
      },
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
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'repay',
    inputs: [
      {
        name: 'safe',
        type: 'address',
        internalType: 'address',
      },
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
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'repayFromCollateral',
    inputs: [
      {
        name: 'safe',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amountUsd',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawCollateral',
    inputs: [
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
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPriceUsd',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'price',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'usable',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'inBand',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenPaused',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'repayTender',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
] as const;
