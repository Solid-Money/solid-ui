import {
  createReadContract,
  createWriteContract,
  createSimulateContract,
  createWatchContractEvent,
} from 'wagmi/codegen'

import {
  createUseReadContract,
  createUseWriteContract,
  createUseSimulateContract,
  createUseWatchContractEvent,
} from 'wagmi/codegen'

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AlgebraBasePlugin
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const algebraBasePluginAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_pool', internalType: 'address', type: 'address' },
      { name: '_factory', internalType: 'address', type: 'address' },
      { name: '_pluginFactory', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  { type: 'error', inputs: [], name: 'targetIsTooOld' },
  { type: 'error', inputs: [], name: 'tickOutOfRange' },
  { type: 'error', inputs: [], name: 'transferFailed' },
  { type: 'error', inputs: [], name: 'volatilityOracleAlreadyInitialized' },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'baseFee',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
    ],
    name: 'BaseFee',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newIncentive',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'Incentive',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'priceChangeFactor',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'PriceChangeFactor',
  },
  {
    type: 'function',
    inputs: [],
    name: 'ALGEBRA_BASE_PLUGIN_MANAGER',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'afterFlash',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint160', type: 'uint160' },
      { name: 'tick', internalType: 'int24', type: 'int24' },
    ],
    name: 'afterInitialize',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'int24', type: 'int24' },
      { name: '', internalType: 'int24', type: 'int24' },
      { name: '', internalType: 'int128', type: 'int128' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'afterModifyPosition',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: 'zeroToOne', internalType: 'bool', type: 'bool' },
      { name: '', internalType: 'int256', type: 'int256' },
      { name: '', internalType: 'uint160', type: 'uint160' },
      { name: '', internalType: 'int256', type: 'int256' },
      { name: '', internalType: 'int256', type: 'int256' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'afterSwap',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'beforeFlash',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint160', type: 'uint160' },
    ],
    name: 'beforeInitialize',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'int24', type: 'int24' },
      { name: '', internalType: 'int24', type: 'int24' },
      { name: '', internalType: 'int128', type: 'int128' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'beforeModifyPosition',
    outputs: [
      { name: '', internalType: 'bytes4', type: 'bytes4' },
      { name: '', internalType: 'uint24', type: 'uint24' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: 'zeroToOne', internalType: 'bool', type: 'bool' },
      { name: '', internalType: 'int256', type: 'int256' },
      { name: '', internalType: 'uint160', type: 'uint160' },
      { name: '', internalType: 'bool', type: 'bool' },
      { name: '', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'beforeSwap',
    outputs: [
      { name: '', internalType: 'bytes4', type: 'bytes4' },
      { name: '', internalType: 'uint24', type: 'uint24' },
      { name: '', internalType: 'uint24', type: 'uint24' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'recipient', internalType: 'address', type: 'address' },
    ],
    name: 'collectPluginFee',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'defaultPluginConfig',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCurrentFee',
    outputs: [{ name: 'fee', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getPool',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'secondsAgo', internalType: 'uint32', type: 'uint32' }],
    name: 'getSingleTimepoint',
    outputs: [
      { name: 'tickCumulative', internalType: 'int56', type: 'int56' },
      { name: 'volatilityCumulative', internalType: 'uint88', type: 'uint88' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'secondsAgos', internalType: 'uint32[]', type: 'uint32[]' },
    ],
    name: 'getTimepoints',
    outputs: [
      { name: 'tickCumulatives', internalType: 'int56[]', type: 'int56[]' },
      {
        name: 'volatilityCumulatives',
        internalType: 'uint88[]',
        type: 'uint88[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'handlePluginFee',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'incentive',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'targetIncentive', internalType: 'address', type: 'address' },
    ],
    name: 'isIncentiveConnected',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'isInitialized',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'lastTimepointTimestamp',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'pool',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'startIndex', internalType: 'uint16', type: 'uint16' },
      { name: 'amount', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'prepayTimepointsStorageSlots',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 's_baseFee',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 's_feeFactors',
    outputs: [
      { name: 'zeroToOneFeeFactor', internalType: 'uint128', type: 'uint128' },
      { name: 'oneToZeroFeeFactor', internalType: 'uint128', type: 'uint128' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 's_priceChangeFactor',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'newBaseFee', internalType: 'uint16', type: 'uint16' }],
    name: 'setBaseFee',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newIncentive', internalType: 'address', type: 'address' },
    ],
    name: 'setIncentive',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPriceChangeFactor', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'setPriceChangeFactor',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'timepointIndex',
    outputs: [{ name: '', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'timepoints',
    outputs: [
      { name: 'initialized', internalType: 'bool', type: 'bool' },
      { name: 'blockTimestamp', internalType: 'uint32', type: 'uint32' },
      { name: 'tickCumulative', internalType: 'int56', type: 'int56' },
      { name: 'volatilityCumulative', internalType: 'uint88', type: 'uint88' },
      { name: 'tick', internalType: 'int24', type: 'int24' },
      { name: 'averageTick', internalType: 'int24', type: 'int24' },
      { name: 'windowStartIndex', internalType: 'uint16', type: 'uint16' },
    ],
    stateMutability: 'view',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AlgebraPool
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const algebraPoolAbi = [
  { type: 'error', inputs: [], name: 'alreadyInitialized' },
  { type: 'error', inputs: [], name: 'arithmeticError' },
  { type: 'error', inputs: [], name: 'bottomTickLowerThanMIN' },
  { type: 'error', inputs: [], name: 'dynamicFeeActive' },
  { type: 'error', inputs: [], name: 'dynamicFeeDisabled' },
  { type: 'error', inputs: [], name: 'flashInsufficientPaid0' },
  { type: 'error', inputs: [], name: 'flashInsufficientPaid1' },
  { type: 'error', inputs: [], name: 'insufficientInputAmount' },
  { type: 'error', inputs: [], name: 'invalidAmountRequired' },
  {
    type: 'error',
    inputs: [{ name: 'selector', internalType: 'bytes4', type: 'bytes4' }],
    name: 'invalidHookResponse',
  },
  { type: 'error', inputs: [], name: 'invalidLimitSqrtPrice' },
  { type: 'error', inputs: [], name: 'invalidNewCommunityFee' },
  { type: 'error', inputs: [], name: 'invalidNewTickSpacing' },
  { type: 'error', inputs: [], name: 'liquidityAdd' },
  { type: 'error', inputs: [], name: 'liquidityOverflow' },
  { type: 'error', inputs: [], name: 'liquiditySub' },
  { type: 'error', inputs: [], name: 'locked' },
  { type: 'error', inputs: [], name: 'notAllowed' },
  { type: 'error', inputs: [], name: 'notInitialized' },
  { type: 'error', inputs: [], name: 'onlyFarming' },
  { type: 'error', inputs: [], name: 'pluginIsNotConnected' },
  { type: 'error', inputs: [], name: 'priceOutOfRange' },
  { type: 'error', inputs: [], name: 'tickInvalidLinks' },
  { type: 'error', inputs: [], name: 'tickIsNotInitialized' },
  { type: 'error', inputs: [], name: 'tickIsNotSpaced' },
  { type: 'error', inputs: [], name: 'tickOutOfRange' },
  { type: 'error', inputs: [], name: 'topTickAboveMAX' },
  { type: 'error', inputs: [], name: 'topTickLowerOrEqBottomTick' },
  { type: 'error', inputs: [], name: 'transferFailed' },
  { type: 'error', inputs: [], name: 'zeroAmountRequired' },
  { type: 'error', inputs: [], name: 'zeroLiquidityActual' },
  { type: 'error', inputs: [], name: 'zeroLiquidityDesired' },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'bottomTick',
        internalType: 'int24',
        type: 'int24',
        indexed: true,
      },
      { name: 'topTick', internalType: 'int24', type: 'int24', indexed: true },
      {
        name: 'liquidityAmount',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'amount0',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'amount1',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Burn',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'bottomTick',
        internalType: 'int24',
        type: 'int24',
        indexed: true,
      },
      { name: 'topTick', internalType: 'int24', type: 'int24', indexed: true },
      {
        name: 'amount0',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'amount1',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
    ],
    name: 'Collect',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'communityFeeNew',
        internalType: 'uint16',
        type: 'uint16',
        indexed: false,
      },
    ],
    name: 'CommunityFee',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'fee', internalType: 'uint16', type: 'uint16', indexed: false },
    ],
    name: 'Fee',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount0',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'amount1',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'paid0',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'paid1',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Flash',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'price',
        internalType: 'uint160',
        type: 'uint160',
        indexed: false,
      },
      { name: 'tick', internalType: 'int24', type: 'int24', indexed: false },
    ],
    name: 'Initialize',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'bottomTick',
        internalType: 'int24',
        type: 'int24',
        indexed: true,
      },
      { name: 'topTick', internalType: 'int24', type: 'int24', indexed: true },
      {
        name: 'liquidityAmount',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'amount0',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'amount1',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Mint',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newPluginAddress',
        internalType: 'address',
        type: 'address',
        indexed: false,
      },
    ],
    name: 'Plugin',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newPluginConfig',
        internalType: 'uint8',
        type: 'uint8',
        indexed: false,
      },
    ],
    name: 'PluginConfig',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'recipient',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount0',
        internalType: 'int256',
        type: 'int256',
        indexed: false,
      },
      {
        name: 'amount1',
        internalType: 'int256',
        type: 'int256',
        indexed: false,
      },
      {
        name: 'price',
        internalType: 'uint160',
        type: 'uint160',
        indexed: false,
      },
      {
        name: 'liquidity',
        internalType: 'uint128',
        type: 'uint128',
        indexed: false,
      },
      { name: 'tick', internalType: 'int24', type: 'int24', indexed: false },
    ],
    name: 'Swap',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newTickSpacing',
        internalType: 'int24',
        type: 'int24',
        indexed: false,
      },
    ],
    name: 'TickSpacing',
  },
  {
    type: 'function',
    inputs: [
      { name: 'bottomTick', internalType: 'int24', type: 'int24' },
      { name: 'topTick', internalType: 'int24', type: 'int24' },
      { name: 'amount', internalType: 'uint128', type: 'uint128' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'burn',
    outputs: [
      { name: 'amount0', internalType: 'uint256', type: 'uint256' },
      { name: 'amount1', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'recipient', internalType: 'address', type: 'address' },
      { name: 'bottomTick', internalType: 'int24', type: 'int24' },
      { name: 'topTick', internalType: 'int24', type: 'int24' },
      { name: 'amount0Requested', internalType: 'uint128', type: 'uint128' },
      { name: 'amount1Requested', internalType: 'uint128', type: 'uint128' },
    ],
    name: 'collect',
    outputs: [
      { name: 'amount0', internalType: 'uint128', type: 'uint128' },
      { name: 'amount1', internalType: 'uint128', type: 'uint128' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'communityFeeLastTimestamp',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'communityVault',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'factory',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'fee',
    outputs: [{ name: 'currentFee', internalType: 'uint16', type: 'uint16' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'recipient', internalType: 'address', type: 'address' },
      { name: 'amount0', internalType: 'uint256', type: 'uint256' },
      { name: 'amount1', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'flash',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getCommunityFeePending',
    outputs: [
      { name: '', internalType: 'uint128', type: 'uint128' },
      { name: '', internalType: 'uint128', type: 'uint128' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getReserves',
    outputs: [
      { name: '', internalType: 'uint128', type: 'uint128' },
      { name: '', internalType: 'uint128', type: 'uint128' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'globalState',
    outputs: [
      { name: 'price', internalType: 'uint160', type: 'uint160' },
      { name: 'tick', internalType: 'int24', type: 'int24' },
      { name: 'fee', internalType: 'uint16', type: 'uint16' },
      { name: 'pluginConfig', internalType: 'uint8', type: 'uint8' },
      { name: 'communityFee', internalType: 'uint16', type: 'uint16' },
      { name: 'unlocked', internalType: 'bool', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'initialPrice', internalType: 'uint160', type: 'uint160' },
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'liquidity',
    outputs: [{ name: '', internalType: 'uint128', type: 'uint128' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxLiquidityPerTick',
    outputs: [{ name: '', internalType: 'uint128', type: 'uint128' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    inputs: [
      { name: 'leftoversRecipient', internalType: 'address', type: 'address' },
      { name: 'recipient', internalType: 'address', type: 'address' },
      { name: 'bottomTick', internalType: 'int24', type: 'int24' },
      { name: 'topTick', internalType: 'int24', type: 'int24' },
      { name: 'liquidityDesired', internalType: 'uint128', type: 'uint128' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'mint',
    outputs: [
      { name: 'amount0', internalType: 'uint256', type: 'uint256' },
      { name: 'amount1', internalType: 'uint256', type: 'uint256' },
      { name: 'liquidityActual', internalType: 'uint128', type: 'uint128' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'nextTickGlobal',
    outputs: [{ name: '', internalType: 'int24', type: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'plugin',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    name: 'positions',
    outputs: [
      { name: 'liquidity', internalType: 'uint256', type: 'uint256' },
      {
        name: 'innerFeeGrowth0Token',
        internalType: 'uint256',
        type: 'uint256',
      },
      {
        name: 'innerFeeGrowth1Token',
        internalType: 'uint256',
        type: 'uint256',
      },
      { name: 'fees0', internalType: 'uint128', type: 'uint128' },
      { name: 'fees1', internalType: 'uint128', type: 'uint128' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'prevTickGlobal',
    outputs: [{ name: '', internalType: 'int24', type: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newCommunityFee', internalType: 'uint16', type: 'uint16' },
    ],
    name: 'setCommunityFee',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newFee', internalType: 'uint16', type: 'uint16' }],
    name: 'setFee',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'newPluginAddress', internalType: 'address', type: 'address' },
    ],
    name: 'setPlugin',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newConfig', internalType: 'uint8', type: 'uint8' }],
    name: 'setPluginConfig',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newTickSpacing', internalType: 'int24', type: 'int24' }],
    name: 'setTickSpacing',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'recipient', internalType: 'address', type: 'address' },
      { name: 'zeroToOne', internalType: 'bool', type: 'bool' },
      { name: 'amountRequired', internalType: 'int256', type: 'int256' },
      { name: 'limitSqrtPrice', internalType: 'uint160', type: 'uint160' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'swap',
    outputs: [
      { name: 'amount0', internalType: 'int256', type: 'int256' },
      { name: 'amount1', internalType: 'int256', type: 'int256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'leftoversRecipient', internalType: 'address', type: 'address' },
      { name: 'recipient', internalType: 'address', type: 'address' },
      { name: 'zeroToOne', internalType: 'bool', type: 'bool' },
      { name: 'amountToSell', internalType: 'int256', type: 'int256' },
      { name: 'limitSqrtPrice', internalType: 'uint160', type: 'uint160' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'swapWithPaymentInAdvance',
    outputs: [
      { name: 'amount0', internalType: 'int256', type: 'int256' },
      { name: 'amount1', internalType: 'int256', type: 'int256' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'tickSpacing',
    outputs: [{ name: '', internalType: 'int24', type: 'int24' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'int16', type: 'int16' }],
    name: 'tickTable',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'int24', type: 'int24' }],
    name: 'ticks',
    outputs: [
      { name: 'liquidityTotal', internalType: 'uint256', type: 'uint256' },
      { name: 'liquidityDelta', internalType: 'int128', type: 'int128' },
      { name: 'prevTick', internalType: 'int24', type: 'int24' },
      { name: 'nextTick', internalType: 'int24', type: 'int24' },
      {
        name: 'outerFeeGrowth0Token',
        internalType: 'uint256',
        type: 'uint256',
      },
      {
        name: 'outerFeeGrowth1Token',
        internalType: 'uint256',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'token0',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'token1',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalFeeGrowth0Token',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalFeeGrowth1Token',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// AlgebraRouter
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const algebraRouterAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_factory', internalType: 'address', type: 'address' },
      { name: '_WNativeToken', internalType: 'address', type: 'address' },
      { name: '_poolDeployer', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'WNativeToken',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount0Delta', internalType: 'int256', type: 'int256' },
      { name: 'amount1Delta', internalType: 'int256', type: 'int256' },
      { name: '_data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'algebraSwapCallback',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct ISwapRouter.ExactInputParams',
        type: 'tuple',
        components: [
          { name: 'path', internalType: 'bytes', type: 'bytes' },
          { name: 'recipient', internalType: 'address', type: 'address' },
          { name: 'deadline', internalType: 'uint256', type: 'uint256' },
          { name: 'amountIn', internalType: 'uint256', type: 'uint256' },
          {
            name: 'amountOutMinimum',
            internalType: 'uint256',
            type: 'uint256',
          },
        ],
      },
    ],
    name: 'exactInput',
    outputs: [{ name: 'amountOut', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct ISwapRouter.ExactInputSingleParams',
        type: 'tuple',
        components: [
          { name: 'tokenIn', internalType: 'address', type: 'address' },
          { name: 'tokenOut', internalType: 'address', type: 'address' },
          { name: 'deployer', internalType: 'address', type: 'address' },
          { name: 'recipient', internalType: 'address', type: 'address' },
          { name: 'deadline', internalType: 'uint256', type: 'uint256' },
          { name: 'amountIn', internalType: 'uint256', type: 'uint256' },
          {
            name: 'amountOutMinimum',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'limitSqrtPrice', internalType: 'uint160', type: 'uint160' },
        ],
      },
    ],
    name: 'exactInputSingle',
    outputs: [{ name: 'amountOut', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct ISwapRouter.ExactInputSingleParams',
        type: 'tuple',
        components: [
          { name: 'tokenIn', internalType: 'address', type: 'address' },
          { name: 'tokenOut', internalType: 'address', type: 'address' },
          { name: 'deployer', internalType: 'address', type: 'address' },
          { name: 'recipient', internalType: 'address', type: 'address' },
          { name: 'deadline', internalType: 'uint256', type: 'uint256' },
          { name: 'amountIn', internalType: 'uint256', type: 'uint256' },
          {
            name: 'amountOutMinimum',
            internalType: 'uint256',
            type: 'uint256',
          },
          { name: 'limitSqrtPrice', internalType: 'uint160', type: 'uint160' },
        ],
      },
    ],
    name: 'exactInputSingleSupportingFeeOnTransferTokens',
    outputs: [{ name: 'amountOut', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct ISwapRouter.ExactOutputParams',
        type: 'tuple',
        components: [
          { name: 'path', internalType: 'bytes', type: 'bytes' },
          { name: 'recipient', internalType: 'address', type: 'address' },
          { name: 'deadline', internalType: 'uint256', type: 'uint256' },
          { name: 'amountOut', internalType: 'uint256', type: 'uint256' },
          { name: 'amountInMaximum', internalType: 'uint256', type: 'uint256' },
        ],
      },
    ],
    name: 'exactOutput',
    outputs: [{ name: 'amountIn', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      {
        name: 'params',
        internalType: 'struct ISwapRouter.ExactOutputSingleParams',
        type: 'tuple',
        components: [
          { name: 'tokenIn', internalType: 'address', type: 'address' },
          { name: 'tokenOut', internalType: 'address', type: 'address' },
          { name: 'deployer', internalType: 'address', type: 'address' },
          { name: 'recipient', internalType: 'address', type: 'address' },
          { name: 'deadline', internalType: 'uint256', type: 'uint256' },
          { name: 'amountOut', internalType: 'uint256', type: 'uint256' },
          { name: 'amountInMaximum', internalType: 'uint256', type: 'uint256' },
          { name: 'limitSqrtPrice', internalType: 'uint160', type: 'uint160' },
        ],
      },
    ],
    name: 'exactOutputSingle',
    outputs: [{ name: 'amountIn', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'factory',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'data', internalType: 'bytes[]', type: 'bytes[]' }],
    name: 'multicall',
    outputs: [{ name: 'results', internalType: 'bytes[]', type: 'bytes[]' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'poolDeployer',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'refundNativeToken',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'v', internalType: 'uint8', type: 'uint8' },
      { name: 'r', internalType: 'bytes32', type: 'bytes32' },
      { name: 's', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'selfPermit',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'nonce', internalType: 'uint256', type: 'uint256' },
      { name: 'expiry', internalType: 'uint256', type: 'uint256' },
      { name: 'v', internalType: 'uint8', type: 'uint8' },
      { name: 'r', internalType: 'bytes32', type: 'bytes32' },
      { name: 's', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'selfPermitAllowed',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'nonce', internalType: 'uint256', type: 'uint256' },
      { name: 'expiry', internalType: 'uint256', type: 'uint256' },
      { name: 'v', internalType: 'uint8', type: 'uint8' },
      { name: 'r', internalType: 'bytes32', type: 'bytes32' },
      { name: 's', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'selfPermitAllowedIfNecessary',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'v', internalType: 'uint8', type: 'uint8' },
      { name: 'r', internalType: 'bytes32', type: 'bytes32' },
      { name: 's', internalType: 'bytes32', type: 'bytes32' },
    ],
    name: 'selfPermitIfNecessary',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'amountMinimum', internalType: 'uint256', type: 'uint256' },
      { name: 'recipient', internalType: 'address', type: 'address' },
    ],
    name: 'sweepToken',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'token', internalType: 'address', type: 'address' },
      { name: 'amountMinimum', internalType: 'uint256', type: 'uint256' },
      { name: 'recipient', internalType: 'address', type: 'address' },
      { name: 'feeBips', internalType: 'uint256', type: 'uint256' },
      { name: 'feeRecipient', internalType: 'address', type: 'address' },
    ],
    name: 'sweepTokenWithFee',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amountMinimum', internalType: 'uint256', type: 'uint256' },
      { name: 'recipient', internalType: 'address', type: 'address' },
    ],
    name: 'unwrapWNativeToken',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amountMinimum', internalType: 'uint256', type: 'uint256' },
      { name: 'recipient', internalType: 'address', type: 'address' },
      { name: 'feeBips', internalType: 'uint256', type: 'uint256' },
      { name: 'feeRecipient', internalType: 'address', type: 'address' },
    ],
    name: 'unwrapWNativeTokenWithFee',
    outputs: [],
    stateMutability: 'payable',
  },
  { type: 'receive', stateMutability: 'payable' },
] as const

export const algebraRouterAddress =
  '0x6E055FfA786Dfe9DBB214b649a9b2A169e6B820b' as const

export const algebraRouterConfig = {
  address: algebraRouterAddress,
  abi: algebraRouterAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// PegSwap
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const pegSwapAbi = [
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'source',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'target',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'LiquidityUpdated',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
    ],
    name: 'OwnershipTransferRequested',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'target',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'StuckTokensRecovered',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'source',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'target',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'caller',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'TokensSwapped',
  },
  { type: 'fallback', stateMutability: 'nonpayable' },
  {
    type: 'function',
    inputs: [],
    name: 'acceptOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'source', internalType: 'address', type: 'address' },
      { name: 'target', internalType: 'address', type: 'address' },
    ],
    name: 'addLiquidity',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'source', internalType: 'address', type: 'address' },
      { name: 'target', internalType: 'address', type: 'address' },
    ],
    name: 'getSwappableAmount',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'targetData', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'onTokenTransfer',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'target', internalType: 'address', type: 'address' },
    ],
    name: 'recoverStuckTokens',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'source', internalType: 'address', type: 'address' },
      { name: 'target', internalType: 'address', type: 'address' },
    ],
    name: 'removeLiquidity',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'source', internalType: 'address', type: 'address' },
      { name: 'target', internalType: 'address', type: 'address' },
    ],
    name: 'swap',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '_to', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// WrappedNative
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const wrappedNativeAbi = [
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [
      { name: 'guy', type: 'address' },
      { name: 'wad', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [
      { name: 'src', type: 'address' },
      { name: 'dst', type: 'address' },
      { name: 'wad', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [{ name: 'wad', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [
      { name: 'dst', type: 'address' },
      { name: 'wad', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    constant: false,
    payable: true,
    type: 'function',
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  { payable: true, type: 'fallback', stateMutability: 'payable' },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'src', type: 'address', indexed: true },
      { name: 'guy', type: 'address', indexed: true },
      { name: 'wad', type: 'uint256', indexed: false },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'src', type: 'address', indexed: true },
      { name: 'dst', type: 'address', indexed: true },
      { name: 'wad', type: 'uint256', indexed: false },
    ],
    name: 'Transfer',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'dst', type: 'address', indexed: true },
      { name: 'wad', type: 'uint256', indexed: false },
    ],
    name: 'Deposit',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'src', type: 'address', indexed: true },
      { name: 'wad', type: 'uint256', indexed: false },
    ],
    name: 'Withdrawal',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Action
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__
 */
export const readAlgebraBasePlugin = /*#__PURE__*/ createReadContract({
  abi: algebraBasePluginAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"ALGEBRA_BASE_PLUGIN_MANAGER"`
 */
export const readAlgebraBasePluginAlgebraBasePluginManager =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'ALGEBRA_BASE_PLUGIN_MANAGER',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"defaultPluginConfig"`
 */
export const readAlgebraBasePluginDefaultPluginConfig =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'defaultPluginConfig',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"getCurrentFee"`
 */
export const readAlgebraBasePluginGetCurrentFee =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'getCurrentFee',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"getPool"`
 */
export const readAlgebraBasePluginGetPool = /*#__PURE__*/ createReadContract({
  abi: algebraBasePluginAbi,
  functionName: 'getPool',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"getSingleTimepoint"`
 */
export const readAlgebraBasePluginGetSingleTimepoint =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'getSingleTimepoint',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"getTimepoints"`
 */
export const readAlgebraBasePluginGetTimepoints =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'getTimepoints',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"handlePluginFee"`
 */
export const readAlgebraBasePluginHandlePluginFee =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'handlePluginFee',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"incentive"`
 */
export const readAlgebraBasePluginIncentive = /*#__PURE__*/ createReadContract({
  abi: algebraBasePluginAbi,
  functionName: 'incentive',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"isIncentiveConnected"`
 */
export const readAlgebraBasePluginIsIncentiveConnected =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'isIncentiveConnected',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"isInitialized"`
 */
export const readAlgebraBasePluginIsInitialized =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'isInitialized',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"lastTimepointTimestamp"`
 */
export const readAlgebraBasePluginLastTimepointTimestamp =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'lastTimepointTimestamp',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"pool"`
 */
export const readAlgebraBasePluginPool = /*#__PURE__*/ createReadContract({
  abi: algebraBasePluginAbi,
  functionName: 'pool',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"s_baseFee"`
 */
export const readAlgebraBasePluginSBaseFee = /*#__PURE__*/ createReadContract({
  abi: algebraBasePluginAbi,
  functionName: 's_baseFee',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"s_feeFactors"`
 */
export const readAlgebraBasePluginSFeeFactors =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 's_feeFactors',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"s_priceChangeFactor"`
 */
export const readAlgebraBasePluginSPriceChangeFactor =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 's_priceChangeFactor',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"timepointIndex"`
 */
export const readAlgebraBasePluginTimepointIndex =
  /*#__PURE__*/ createReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'timepointIndex',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"timepoints"`
 */
export const readAlgebraBasePluginTimepoints = /*#__PURE__*/ createReadContract(
  { abi: algebraBasePluginAbi, functionName: 'timepoints' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__
 */
export const writeAlgebraBasePlugin = /*#__PURE__*/ createWriteContract({
  abi: algebraBasePluginAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterFlash"`
 */
export const writeAlgebraBasePluginAfterFlash =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterFlash',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterInitialize"`
 */
export const writeAlgebraBasePluginAfterInitialize =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterInitialize',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterModifyPosition"`
 */
export const writeAlgebraBasePluginAfterModifyPosition =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterModifyPosition',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterSwap"`
 */
export const writeAlgebraBasePluginAfterSwap =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterSwap',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeFlash"`
 */
export const writeAlgebraBasePluginBeforeFlash =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeFlash',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeInitialize"`
 */
export const writeAlgebraBasePluginBeforeInitialize =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeInitialize',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeModifyPosition"`
 */
export const writeAlgebraBasePluginBeforeModifyPosition =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeModifyPosition',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeSwap"`
 */
export const writeAlgebraBasePluginBeforeSwap =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeSwap',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"collectPluginFee"`
 */
export const writeAlgebraBasePluginCollectPluginFee =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'collectPluginFee',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"initialize"`
 */
export const writeAlgebraBasePluginInitialize =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"prepayTimepointsStorageSlots"`
 */
export const writeAlgebraBasePluginPrepayTimepointsStorageSlots =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'prepayTimepointsStorageSlots',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setBaseFee"`
 */
export const writeAlgebraBasePluginSetBaseFee =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'setBaseFee',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setIncentive"`
 */
export const writeAlgebraBasePluginSetIncentive =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'setIncentive',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setPriceChangeFactor"`
 */
export const writeAlgebraBasePluginSetPriceChangeFactor =
  /*#__PURE__*/ createWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'setPriceChangeFactor',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__
 */
export const simulateAlgebraBasePlugin = /*#__PURE__*/ createSimulateContract({
  abi: algebraBasePluginAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterFlash"`
 */
export const simulateAlgebraBasePluginAfterFlash =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterFlash',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterInitialize"`
 */
export const simulateAlgebraBasePluginAfterInitialize =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterInitialize',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterModifyPosition"`
 */
export const simulateAlgebraBasePluginAfterModifyPosition =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterModifyPosition',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterSwap"`
 */
export const simulateAlgebraBasePluginAfterSwap =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterSwap',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeFlash"`
 */
export const simulateAlgebraBasePluginBeforeFlash =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeFlash',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeInitialize"`
 */
export const simulateAlgebraBasePluginBeforeInitialize =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeInitialize',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeModifyPosition"`
 */
export const simulateAlgebraBasePluginBeforeModifyPosition =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeModifyPosition',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeSwap"`
 */
export const simulateAlgebraBasePluginBeforeSwap =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeSwap',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"collectPluginFee"`
 */
export const simulateAlgebraBasePluginCollectPluginFee =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'collectPluginFee',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"initialize"`
 */
export const simulateAlgebraBasePluginInitialize =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"prepayTimepointsStorageSlots"`
 */
export const simulateAlgebraBasePluginPrepayTimepointsStorageSlots =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'prepayTimepointsStorageSlots',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setBaseFee"`
 */
export const simulateAlgebraBasePluginSetBaseFee =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'setBaseFee',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setIncentive"`
 */
export const simulateAlgebraBasePluginSetIncentive =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'setIncentive',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setPriceChangeFactor"`
 */
export const simulateAlgebraBasePluginSetPriceChangeFactor =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'setPriceChangeFactor',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraBasePluginAbi}__
 */
export const watchAlgebraBasePluginEvent =
  /*#__PURE__*/ createWatchContractEvent({ abi: algebraBasePluginAbi })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `eventName` set to `"BaseFee"`
 */
export const watchAlgebraBasePluginBaseFeeEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: algebraBasePluginAbi,
    eventName: 'BaseFee',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `eventName` set to `"Incentive"`
 */
export const watchAlgebraBasePluginIncentiveEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: algebraBasePluginAbi,
    eventName: 'Incentive',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `eventName` set to `"PriceChangeFactor"`
 */
export const watchAlgebraBasePluginPriceChangeFactorEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: algebraBasePluginAbi,
    eventName: 'PriceChangeFactor',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__
 */
export const readAlgebraPool = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"communityFeeLastTimestamp"`
 */
export const readAlgebraPoolCommunityFeeLastTimestamp =
  /*#__PURE__*/ createReadContract({
    abi: algebraPoolAbi,
    functionName: 'communityFeeLastTimestamp',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"communityVault"`
 */
export const readAlgebraPoolCommunityVault = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'communityVault',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"factory"`
 */
export const readAlgebraPoolFactory = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'factory',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"fee"`
 */
export const readAlgebraPoolFee = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'fee',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"getCommunityFeePending"`
 */
export const readAlgebraPoolGetCommunityFeePending =
  /*#__PURE__*/ createReadContract({
    abi: algebraPoolAbi,
    functionName: 'getCommunityFeePending',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"getReserves"`
 */
export const readAlgebraPoolGetReserves = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'getReserves',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"globalState"`
 */
export const readAlgebraPoolGlobalState = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'globalState',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"liquidity"`
 */
export const readAlgebraPoolLiquidity = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'liquidity',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"maxLiquidityPerTick"`
 */
export const readAlgebraPoolMaxLiquidityPerTick =
  /*#__PURE__*/ createReadContract({
    abi: algebraPoolAbi,
    functionName: 'maxLiquidityPerTick',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"nextTickGlobal"`
 */
export const readAlgebraPoolNextTickGlobal = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'nextTickGlobal',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"plugin"`
 */
export const readAlgebraPoolPlugin = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'plugin',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"positions"`
 */
export const readAlgebraPoolPositions = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'positions',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"prevTickGlobal"`
 */
export const readAlgebraPoolPrevTickGlobal = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'prevTickGlobal',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"tickSpacing"`
 */
export const readAlgebraPoolTickSpacing = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'tickSpacing',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"tickTable"`
 */
export const readAlgebraPoolTickTable = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'tickTable',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"ticks"`
 */
export const readAlgebraPoolTicks = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'ticks',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"token0"`
 */
export const readAlgebraPoolToken0 = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'token0',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"token1"`
 */
export const readAlgebraPoolToken1 = /*#__PURE__*/ createReadContract({
  abi: algebraPoolAbi,
  functionName: 'token1',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"totalFeeGrowth0Token"`
 */
export const readAlgebraPoolTotalFeeGrowth0Token =
  /*#__PURE__*/ createReadContract({
    abi: algebraPoolAbi,
    functionName: 'totalFeeGrowth0Token',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"totalFeeGrowth1Token"`
 */
export const readAlgebraPoolTotalFeeGrowth1Token =
  /*#__PURE__*/ createReadContract({
    abi: algebraPoolAbi,
    functionName: 'totalFeeGrowth1Token',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__
 */
export const writeAlgebraPool = /*#__PURE__*/ createWriteContract({
  abi: algebraPoolAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"burn"`
 */
export const writeAlgebraPoolBurn = /*#__PURE__*/ createWriteContract({
  abi: algebraPoolAbi,
  functionName: 'burn',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"collect"`
 */
export const writeAlgebraPoolCollect = /*#__PURE__*/ createWriteContract({
  abi: algebraPoolAbi,
  functionName: 'collect',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"flash"`
 */
export const writeAlgebraPoolFlash = /*#__PURE__*/ createWriteContract({
  abi: algebraPoolAbi,
  functionName: 'flash',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"initialize"`
 */
export const writeAlgebraPoolInitialize = /*#__PURE__*/ createWriteContract({
  abi: algebraPoolAbi,
  functionName: 'initialize',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"mint"`
 */
export const writeAlgebraPoolMint = /*#__PURE__*/ createWriteContract({
  abi: algebraPoolAbi,
  functionName: 'mint',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setCommunityFee"`
 */
export const writeAlgebraPoolSetCommunityFee =
  /*#__PURE__*/ createWriteContract({
    abi: algebraPoolAbi,
    functionName: 'setCommunityFee',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setFee"`
 */
export const writeAlgebraPoolSetFee = /*#__PURE__*/ createWriteContract({
  abi: algebraPoolAbi,
  functionName: 'setFee',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setPlugin"`
 */
export const writeAlgebraPoolSetPlugin = /*#__PURE__*/ createWriteContract({
  abi: algebraPoolAbi,
  functionName: 'setPlugin',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setPluginConfig"`
 */
export const writeAlgebraPoolSetPluginConfig =
  /*#__PURE__*/ createWriteContract({
    abi: algebraPoolAbi,
    functionName: 'setPluginConfig',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setTickSpacing"`
 */
export const writeAlgebraPoolSetTickSpacing = /*#__PURE__*/ createWriteContract(
  { abi: algebraPoolAbi, functionName: 'setTickSpacing' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"swap"`
 */
export const writeAlgebraPoolSwap = /*#__PURE__*/ createWriteContract({
  abi: algebraPoolAbi,
  functionName: 'swap',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"swapWithPaymentInAdvance"`
 */
export const writeAlgebraPoolSwapWithPaymentInAdvance =
  /*#__PURE__*/ createWriteContract({
    abi: algebraPoolAbi,
    functionName: 'swapWithPaymentInAdvance',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__
 */
export const simulateAlgebraPool = /*#__PURE__*/ createSimulateContract({
  abi: algebraPoolAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"burn"`
 */
export const simulateAlgebraPoolBurn = /*#__PURE__*/ createSimulateContract({
  abi: algebraPoolAbi,
  functionName: 'burn',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"collect"`
 */
export const simulateAlgebraPoolCollect = /*#__PURE__*/ createSimulateContract({
  abi: algebraPoolAbi,
  functionName: 'collect',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"flash"`
 */
export const simulateAlgebraPoolFlash = /*#__PURE__*/ createSimulateContract({
  abi: algebraPoolAbi,
  functionName: 'flash',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"initialize"`
 */
export const simulateAlgebraPoolInitialize =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"mint"`
 */
export const simulateAlgebraPoolMint = /*#__PURE__*/ createSimulateContract({
  abi: algebraPoolAbi,
  functionName: 'mint',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setCommunityFee"`
 */
export const simulateAlgebraPoolSetCommunityFee =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'setCommunityFee',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setFee"`
 */
export const simulateAlgebraPoolSetFee = /*#__PURE__*/ createSimulateContract({
  abi: algebraPoolAbi,
  functionName: 'setFee',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setPlugin"`
 */
export const simulateAlgebraPoolSetPlugin =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'setPlugin',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setPluginConfig"`
 */
export const simulateAlgebraPoolSetPluginConfig =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'setPluginConfig',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setTickSpacing"`
 */
export const simulateAlgebraPoolSetTickSpacing =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'setTickSpacing',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"swap"`
 */
export const simulateAlgebraPoolSwap = /*#__PURE__*/ createSimulateContract({
  abi: algebraPoolAbi,
  functionName: 'swap',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"swapWithPaymentInAdvance"`
 */
export const simulateAlgebraPoolSwapWithPaymentInAdvance =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'swapWithPaymentInAdvance',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__
 */
export const watchAlgebraPoolEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: algebraPoolAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Burn"`
 */
export const watchAlgebraPoolBurnEvent = /*#__PURE__*/ createWatchContractEvent(
  { abi: algebraPoolAbi, eventName: 'Burn' },
)

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Collect"`
 */
export const watchAlgebraPoolCollectEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Collect',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"CommunityFee"`
 */
export const watchAlgebraPoolCommunityFeeEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'CommunityFee',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Fee"`
 */
export const watchAlgebraPoolFeeEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: algebraPoolAbi,
  eventName: 'Fee',
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Flash"`
 */
export const watchAlgebraPoolFlashEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Flash',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Initialize"`
 */
export const watchAlgebraPoolInitializeEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Initialize',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Mint"`
 */
export const watchAlgebraPoolMintEvent = /*#__PURE__*/ createWatchContractEvent(
  { abi: algebraPoolAbi, eventName: 'Mint' },
)

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Plugin"`
 */
export const watchAlgebraPoolPluginEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Plugin',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"PluginConfig"`
 */
export const watchAlgebraPoolPluginConfigEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'PluginConfig',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Swap"`
 */
export const watchAlgebraPoolSwapEvent = /*#__PURE__*/ createWatchContractEvent(
  { abi: algebraPoolAbi, eventName: 'Swap' },
)

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"TickSpacing"`
 */
export const watchAlgebraPoolTickSpacingEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'TickSpacing',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraRouterAbi}__
 */
export const readAlgebraRouter = /*#__PURE__*/ createReadContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"WNativeToken"`
 */
export const readAlgebraRouterWNativeToken = /*#__PURE__*/ createReadContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
  functionName: 'WNativeToken',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"factory"`
 */
export const readAlgebraRouterFactory = /*#__PURE__*/ createReadContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
  functionName: 'factory',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"poolDeployer"`
 */
export const readAlgebraRouterPoolDeployer = /*#__PURE__*/ createReadContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
  functionName: 'poolDeployer',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__
 */
export const writeAlgebraRouter = /*#__PURE__*/ createWriteContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"algebraSwapCallback"`
 */
export const writeAlgebraRouterAlgebraSwapCallback =
  /*#__PURE__*/ createWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'algebraSwapCallback',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInput"`
 */
export const writeAlgebraRouterExactInput = /*#__PURE__*/ createWriteContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
  functionName: 'exactInput',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInputSingle"`
 */
export const writeAlgebraRouterExactInputSingle =
  /*#__PURE__*/ createWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactInputSingle',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInputSingleSupportingFeeOnTransferTokens"`
 */
export const writeAlgebraRouterExactInputSingleSupportingFeeOnTransferTokens =
  /*#__PURE__*/ createWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactInputSingleSupportingFeeOnTransferTokens',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactOutput"`
 */
export const writeAlgebraRouterExactOutput = /*#__PURE__*/ createWriteContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
  functionName: 'exactOutput',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactOutputSingle"`
 */
export const writeAlgebraRouterExactOutputSingle =
  /*#__PURE__*/ createWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactOutputSingle',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"multicall"`
 */
export const writeAlgebraRouterMulticall = /*#__PURE__*/ createWriteContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
  functionName: 'multicall',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"refundNativeToken"`
 */
export const writeAlgebraRouterRefundNativeToken =
  /*#__PURE__*/ createWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'refundNativeToken',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermit"`
 */
export const writeAlgebraRouterSelfPermit = /*#__PURE__*/ createWriteContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
  functionName: 'selfPermit',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitAllowed"`
 */
export const writeAlgebraRouterSelfPermitAllowed =
  /*#__PURE__*/ createWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitAllowed',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitAllowedIfNecessary"`
 */
export const writeAlgebraRouterSelfPermitAllowedIfNecessary =
  /*#__PURE__*/ createWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitAllowedIfNecessary',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitIfNecessary"`
 */
export const writeAlgebraRouterSelfPermitIfNecessary =
  /*#__PURE__*/ createWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitIfNecessary',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"sweepToken"`
 */
export const writeAlgebraRouterSweepToken = /*#__PURE__*/ createWriteContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
  functionName: 'sweepToken',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"sweepTokenWithFee"`
 */
export const writeAlgebraRouterSweepTokenWithFee =
  /*#__PURE__*/ createWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'sweepTokenWithFee',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"unwrapWNativeToken"`
 */
export const writeAlgebraRouterUnwrapWNativeToken =
  /*#__PURE__*/ createWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'unwrapWNativeToken',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"unwrapWNativeTokenWithFee"`
 */
export const writeAlgebraRouterUnwrapWNativeTokenWithFee =
  /*#__PURE__*/ createWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'unwrapWNativeTokenWithFee',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__
 */
export const simulateAlgebraRouter = /*#__PURE__*/ createSimulateContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"algebraSwapCallback"`
 */
export const simulateAlgebraRouterAlgebraSwapCallback =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'algebraSwapCallback',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInput"`
 */
export const simulateAlgebraRouterExactInput =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactInput',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInputSingle"`
 */
export const simulateAlgebraRouterExactInputSingle =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactInputSingle',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInputSingleSupportingFeeOnTransferTokens"`
 */
export const simulateAlgebraRouterExactInputSingleSupportingFeeOnTransferTokens =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactInputSingleSupportingFeeOnTransferTokens',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactOutput"`
 */
export const simulateAlgebraRouterExactOutput =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactOutput',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactOutputSingle"`
 */
export const simulateAlgebraRouterExactOutputSingle =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactOutputSingle',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"multicall"`
 */
export const simulateAlgebraRouterMulticall =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'multicall',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"refundNativeToken"`
 */
export const simulateAlgebraRouterRefundNativeToken =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'refundNativeToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermit"`
 */
export const simulateAlgebraRouterSelfPermit =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermit',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitAllowed"`
 */
export const simulateAlgebraRouterSelfPermitAllowed =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitAllowed',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitAllowedIfNecessary"`
 */
export const simulateAlgebraRouterSelfPermitAllowedIfNecessary =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitAllowedIfNecessary',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitIfNecessary"`
 */
export const simulateAlgebraRouterSelfPermitIfNecessary =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitIfNecessary',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"sweepToken"`
 */
export const simulateAlgebraRouterSweepToken =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'sweepToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"sweepTokenWithFee"`
 */
export const simulateAlgebraRouterSweepTokenWithFee =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'sweepTokenWithFee',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"unwrapWNativeToken"`
 */
export const simulateAlgebraRouterUnwrapWNativeToken =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'unwrapWNativeToken',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"unwrapWNativeTokenWithFee"`
 */
export const simulateAlgebraRouterUnwrapWNativeTokenWithFee =
  /*#__PURE__*/ createSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'unwrapWNativeTokenWithFee',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link pegSwapAbi}__
 */
export const readPegSwap = /*#__PURE__*/ createReadContract({ abi: pegSwapAbi })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"getSwappableAmount"`
 */
export const readPegSwapGetSwappableAmount = /*#__PURE__*/ createReadContract({
  abi: pegSwapAbi,
  functionName: 'getSwappableAmount',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"owner"`
 */
export const readPegSwapOwner = /*#__PURE__*/ createReadContract({
  abi: pegSwapAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link pegSwapAbi}__
 */
export const writePegSwap = /*#__PURE__*/ createWriteContract({
  abi: pegSwapAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"acceptOwnership"`
 */
export const writePegSwapAcceptOwnership = /*#__PURE__*/ createWriteContract({
  abi: pegSwapAbi,
  functionName: 'acceptOwnership',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"addLiquidity"`
 */
export const writePegSwapAddLiquidity = /*#__PURE__*/ createWriteContract({
  abi: pegSwapAbi,
  functionName: 'addLiquidity',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"onTokenTransfer"`
 */
export const writePegSwapOnTokenTransfer = /*#__PURE__*/ createWriteContract({
  abi: pegSwapAbi,
  functionName: 'onTokenTransfer',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"recoverStuckTokens"`
 */
export const writePegSwapRecoverStuckTokens = /*#__PURE__*/ createWriteContract(
  { abi: pegSwapAbi, functionName: 'recoverStuckTokens' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"removeLiquidity"`
 */
export const writePegSwapRemoveLiquidity = /*#__PURE__*/ createWriteContract({
  abi: pegSwapAbi,
  functionName: 'removeLiquidity',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"swap"`
 */
export const writePegSwapSwap = /*#__PURE__*/ createWriteContract({
  abi: pegSwapAbi,
  functionName: 'swap',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const writePegSwapTransferOwnership = /*#__PURE__*/ createWriteContract({
  abi: pegSwapAbi,
  functionName: 'transferOwnership',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link pegSwapAbi}__
 */
export const simulatePegSwap = /*#__PURE__*/ createSimulateContract({
  abi: pegSwapAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"acceptOwnership"`
 */
export const simulatePegSwapAcceptOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: pegSwapAbi,
    functionName: 'acceptOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"addLiquidity"`
 */
export const simulatePegSwapAddLiquidity = /*#__PURE__*/ createSimulateContract(
  { abi: pegSwapAbi, functionName: 'addLiquidity' },
)

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"onTokenTransfer"`
 */
export const simulatePegSwapOnTokenTransfer =
  /*#__PURE__*/ createSimulateContract({
    abi: pegSwapAbi,
    functionName: 'onTokenTransfer',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"recoverStuckTokens"`
 */
export const simulatePegSwapRecoverStuckTokens =
  /*#__PURE__*/ createSimulateContract({
    abi: pegSwapAbi,
    functionName: 'recoverStuckTokens',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"removeLiquidity"`
 */
export const simulatePegSwapRemoveLiquidity =
  /*#__PURE__*/ createSimulateContract({
    abi: pegSwapAbi,
    functionName: 'removeLiquidity',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"swap"`
 */
export const simulatePegSwapSwap = /*#__PURE__*/ createSimulateContract({
  abi: pegSwapAbi,
  functionName: 'swap',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const simulatePegSwapTransferOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: pegSwapAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__
 */
export const watchPegSwapEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: pegSwapAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__ and `eventName` set to `"LiquidityUpdated"`
 */
export const watchPegSwapLiquidityUpdatedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: pegSwapAbi,
    eventName: 'LiquidityUpdated',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__ and `eventName` set to `"OwnershipTransferRequested"`
 */
export const watchPegSwapOwnershipTransferRequestedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: pegSwapAbi,
    eventName: 'OwnershipTransferRequested',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const watchPegSwapOwnershipTransferredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: pegSwapAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__ and `eventName` set to `"StuckTokensRecovered"`
 */
export const watchPegSwapStuckTokensRecoveredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: pegSwapAbi,
    eventName: 'StuckTokensRecovered',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__ and `eventName` set to `"TokensSwapped"`
 */
export const watchPegSwapTokensSwappedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: pegSwapAbi,
    eventName: 'TokensSwapped',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link wrappedNativeAbi}__
 */
export const readWrappedNative = /*#__PURE__*/ createReadContract({
  abi: wrappedNativeAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"name"`
 */
export const readWrappedNativeName = /*#__PURE__*/ createReadContract({
  abi: wrappedNativeAbi,
  functionName: 'name',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"totalSupply"`
 */
export const readWrappedNativeTotalSupply = /*#__PURE__*/ createReadContract({
  abi: wrappedNativeAbi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"decimals"`
 */
export const readWrappedNativeDecimals = /*#__PURE__*/ createReadContract({
  abi: wrappedNativeAbi,
  functionName: 'decimals',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"balanceOf"`
 */
export const readWrappedNativeBalanceOf = /*#__PURE__*/ createReadContract({
  abi: wrappedNativeAbi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"symbol"`
 */
export const readWrappedNativeSymbol = /*#__PURE__*/ createReadContract({
  abi: wrappedNativeAbi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"allowance"`
 */
export const readWrappedNativeAllowance = /*#__PURE__*/ createReadContract({
  abi: wrappedNativeAbi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link wrappedNativeAbi}__
 */
export const writeWrappedNative = /*#__PURE__*/ createWriteContract({
  abi: wrappedNativeAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"approve"`
 */
export const writeWrappedNativeApprove = /*#__PURE__*/ createWriteContract({
  abi: wrappedNativeAbi,
  functionName: 'approve',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"transferFrom"`
 */
export const writeWrappedNativeTransferFrom = /*#__PURE__*/ createWriteContract(
  { abi: wrappedNativeAbi, functionName: 'transferFrom' },
)

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"withdraw"`
 */
export const writeWrappedNativeWithdraw = /*#__PURE__*/ createWriteContract({
  abi: wrappedNativeAbi,
  functionName: 'withdraw',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"transfer"`
 */
export const writeWrappedNativeTransfer = /*#__PURE__*/ createWriteContract({
  abi: wrappedNativeAbi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"deposit"`
 */
export const writeWrappedNativeDeposit = /*#__PURE__*/ createWriteContract({
  abi: wrappedNativeAbi,
  functionName: 'deposit',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__
 */
export const simulateWrappedNative = /*#__PURE__*/ createSimulateContract({
  abi: wrappedNativeAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"approve"`
 */
export const simulateWrappedNativeApprove =
  /*#__PURE__*/ createSimulateContract({
    abi: wrappedNativeAbi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"transferFrom"`
 */
export const simulateWrappedNativeTransferFrom =
  /*#__PURE__*/ createSimulateContract({
    abi: wrappedNativeAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"withdraw"`
 */
export const simulateWrappedNativeWithdraw =
  /*#__PURE__*/ createSimulateContract({
    abi: wrappedNativeAbi,
    functionName: 'withdraw',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"transfer"`
 */
export const simulateWrappedNativeTransfer =
  /*#__PURE__*/ createSimulateContract({
    abi: wrappedNativeAbi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"deposit"`
 */
export const simulateWrappedNativeDeposit =
  /*#__PURE__*/ createSimulateContract({
    abi: wrappedNativeAbi,
    functionName: 'deposit',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link wrappedNativeAbi}__
 */
export const watchWrappedNativeEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: wrappedNativeAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link wrappedNativeAbi}__ and `eventName` set to `"Approval"`
 */
export const watchWrappedNativeApprovalEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: wrappedNativeAbi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link wrappedNativeAbi}__ and `eventName` set to `"Transfer"`
 */
export const watchWrappedNativeTransferEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: wrappedNativeAbi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link wrappedNativeAbi}__ and `eventName` set to `"Deposit"`
 */
export const watchWrappedNativeDepositEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: wrappedNativeAbi,
    eventName: 'Deposit',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link wrappedNativeAbi}__ and `eventName` set to `"Withdrawal"`
 */
export const watchWrappedNativeWithdrawalEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: wrappedNativeAbi,
    eventName: 'Withdrawal',
  })

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// React
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__
 */
export const useReadAlgebraBasePlugin = /*#__PURE__*/ createUseReadContract({
  abi: algebraBasePluginAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"ALGEBRA_BASE_PLUGIN_MANAGER"`
 */
export const useReadAlgebraBasePluginAlgebraBasePluginManager =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'ALGEBRA_BASE_PLUGIN_MANAGER',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"defaultPluginConfig"`
 */
export const useReadAlgebraBasePluginDefaultPluginConfig =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'defaultPluginConfig',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"getCurrentFee"`
 */
export const useReadAlgebraBasePluginGetCurrentFee =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'getCurrentFee',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"getPool"`
 */
export const useReadAlgebraBasePluginGetPool =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'getPool',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"getSingleTimepoint"`
 */
export const useReadAlgebraBasePluginGetSingleTimepoint =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'getSingleTimepoint',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"getTimepoints"`
 */
export const useReadAlgebraBasePluginGetTimepoints =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'getTimepoints',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"handlePluginFee"`
 */
export const useReadAlgebraBasePluginHandlePluginFee =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'handlePluginFee',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"incentive"`
 */
export const useReadAlgebraBasePluginIncentive =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'incentive',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"isIncentiveConnected"`
 */
export const useReadAlgebraBasePluginIsIncentiveConnected =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'isIncentiveConnected',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"isInitialized"`
 */
export const useReadAlgebraBasePluginIsInitialized =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'isInitialized',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"lastTimepointTimestamp"`
 */
export const useReadAlgebraBasePluginLastTimepointTimestamp =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'lastTimepointTimestamp',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"pool"`
 */
export const useReadAlgebraBasePluginPool = /*#__PURE__*/ createUseReadContract(
  { abi: algebraBasePluginAbi, functionName: 'pool' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"s_baseFee"`
 */
export const useReadAlgebraBasePluginSBaseFee =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 's_baseFee',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"s_feeFactors"`
 */
export const useReadAlgebraBasePluginSFeeFactors =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 's_feeFactors',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"s_priceChangeFactor"`
 */
export const useReadAlgebraBasePluginSPriceChangeFactor =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 's_priceChangeFactor',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"timepointIndex"`
 */
export const useReadAlgebraBasePluginTimepointIndex =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'timepointIndex',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"timepoints"`
 */
export const useReadAlgebraBasePluginTimepoints =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraBasePluginAbi,
    functionName: 'timepoints',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__
 */
export const useWriteAlgebraBasePlugin = /*#__PURE__*/ createUseWriteContract({
  abi: algebraBasePluginAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterFlash"`
 */
export const useWriteAlgebraBasePluginAfterFlash =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterFlash',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterInitialize"`
 */
export const useWriteAlgebraBasePluginAfterInitialize =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterInitialize',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterModifyPosition"`
 */
export const useWriteAlgebraBasePluginAfterModifyPosition =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterModifyPosition',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterSwap"`
 */
export const useWriteAlgebraBasePluginAfterSwap =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterSwap',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeFlash"`
 */
export const useWriteAlgebraBasePluginBeforeFlash =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeFlash',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeInitialize"`
 */
export const useWriteAlgebraBasePluginBeforeInitialize =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeInitialize',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeModifyPosition"`
 */
export const useWriteAlgebraBasePluginBeforeModifyPosition =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeModifyPosition',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeSwap"`
 */
export const useWriteAlgebraBasePluginBeforeSwap =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeSwap',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"collectPluginFee"`
 */
export const useWriteAlgebraBasePluginCollectPluginFee =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'collectPluginFee',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"initialize"`
 */
export const useWriteAlgebraBasePluginInitialize =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"prepayTimepointsStorageSlots"`
 */
export const useWriteAlgebraBasePluginPrepayTimepointsStorageSlots =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'prepayTimepointsStorageSlots',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setBaseFee"`
 */
export const useWriteAlgebraBasePluginSetBaseFee =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'setBaseFee',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setIncentive"`
 */
export const useWriteAlgebraBasePluginSetIncentive =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'setIncentive',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setPriceChangeFactor"`
 */
export const useWriteAlgebraBasePluginSetPriceChangeFactor =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraBasePluginAbi,
    functionName: 'setPriceChangeFactor',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__
 */
export const useSimulateAlgebraBasePlugin =
  /*#__PURE__*/ createUseSimulateContract({ abi: algebraBasePluginAbi })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterFlash"`
 */
export const useSimulateAlgebraBasePluginAfterFlash =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterFlash',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterInitialize"`
 */
export const useSimulateAlgebraBasePluginAfterInitialize =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterInitialize',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterModifyPosition"`
 */
export const useSimulateAlgebraBasePluginAfterModifyPosition =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterModifyPosition',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"afterSwap"`
 */
export const useSimulateAlgebraBasePluginAfterSwap =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'afterSwap',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeFlash"`
 */
export const useSimulateAlgebraBasePluginBeforeFlash =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeFlash',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeInitialize"`
 */
export const useSimulateAlgebraBasePluginBeforeInitialize =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeInitialize',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeModifyPosition"`
 */
export const useSimulateAlgebraBasePluginBeforeModifyPosition =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeModifyPosition',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"beforeSwap"`
 */
export const useSimulateAlgebraBasePluginBeforeSwap =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'beforeSwap',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"collectPluginFee"`
 */
export const useSimulateAlgebraBasePluginCollectPluginFee =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'collectPluginFee',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"initialize"`
 */
export const useSimulateAlgebraBasePluginInitialize =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"prepayTimepointsStorageSlots"`
 */
export const useSimulateAlgebraBasePluginPrepayTimepointsStorageSlots =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'prepayTimepointsStorageSlots',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setBaseFee"`
 */
export const useSimulateAlgebraBasePluginSetBaseFee =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'setBaseFee',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setIncentive"`
 */
export const useSimulateAlgebraBasePluginSetIncentive =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'setIncentive',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `functionName` set to `"setPriceChangeFactor"`
 */
export const useSimulateAlgebraBasePluginSetPriceChangeFactor =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraBasePluginAbi,
    functionName: 'setPriceChangeFactor',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraBasePluginAbi}__
 */
export const useWatchAlgebraBasePluginEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: algebraBasePluginAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `eventName` set to `"BaseFee"`
 */
export const useWatchAlgebraBasePluginBaseFeeEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraBasePluginAbi,
    eventName: 'BaseFee',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `eventName` set to `"Incentive"`
 */
export const useWatchAlgebraBasePluginIncentiveEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraBasePluginAbi,
    eventName: 'Incentive',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraBasePluginAbi}__ and `eventName` set to `"PriceChangeFactor"`
 */
export const useWatchAlgebraBasePluginPriceChangeFactorEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraBasePluginAbi,
    eventName: 'PriceChangeFactor',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__
 */
export const useReadAlgebraPool = /*#__PURE__*/ createUseReadContract({
  abi: algebraPoolAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"communityFeeLastTimestamp"`
 */
export const useReadAlgebraPoolCommunityFeeLastTimestamp =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraPoolAbi,
    functionName: 'communityFeeLastTimestamp',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"communityVault"`
 */
export const useReadAlgebraPoolCommunityVault =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraPoolAbi,
    functionName: 'communityVault',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"factory"`
 */
export const useReadAlgebraPoolFactory = /*#__PURE__*/ createUseReadContract({
  abi: algebraPoolAbi,
  functionName: 'factory',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"fee"`
 */
export const useReadAlgebraPoolFee = /*#__PURE__*/ createUseReadContract({
  abi: algebraPoolAbi,
  functionName: 'fee',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"getCommunityFeePending"`
 */
export const useReadAlgebraPoolGetCommunityFeePending =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraPoolAbi,
    functionName: 'getCommunityFeePending',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"getReserves"`
 */
export const useReadAlgebraPoolGetReserves =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraPoolAbi,
    functionName: 'getReserves',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"globalState"`
 */
export const useReadAlgebraPoolGlobalState =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraPoolAbi,
    functionName: 'globalState',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"liquidity"`
 */
export const useReadAlgebraPoolLiquidity = /*#__PURE__*/ createUseReadContract({
  abi: algebraPoolAbi,
  functionName: 'liquidity',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"maxLiquidityPerTick"`
 */
export const useReadAlgebraPoolMaxLiquidityPerTick =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraPoolAbi,
    functionName: 'maxLiquidityPerTick',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"nextTickGlobal"`
 */
export const useReadAlgebraPoolNextTickGlobal =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraPoolAbi,
    functionName: 'nextTickGlobal',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"plugin"`
 */
export const useReadAlgebraPoolPlugin = /*#__PURE__*/ createUseReadContract({
  abi: algebraPoolAbi,
  functionName: 'plugin',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"positions"`
 */
export const useReadAlgebraPoolPositions = /*#__PURE__*/ createUseReadContract({
  abi: algebraPoolAbi,
  functionName: 'positions',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"prevTickGlobal"`
 */
export const useReadAlgebraPoolPrevTickGlobal =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraPoolAbi,
    functionName: 'prevTickGlobal',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"tickSpacing"`
 */
export const useReadAlgebraPoolTickSpacing =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraPoolAbi,
    functionName: 'tickSpacing',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"tickTable"`
 */
export const useReadAlgebraPoolTickTable = /*#__PURE__*/ createUseReadContract({
  abi: algebraPoolAbi,
  functionName: 'tickTable',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"ticks"`
 */
export const useReadAlgebraPoolTicks = /*#__PURE__*/ createUseReadContract({
  abi: algebraPoolAbi,
  functionName: 'ticks',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"token0"`
 */
export const useReadAlgebraPoolToken0 = /*#__PURE__*/ createUseReadContract({
  abi: algebraPoolAbi,
  functionName: 'token0',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"token1"`
 */
export const useReadAlgebraPoolToken1 = /*#__PURE__*/ createUseReadContract({
  abi: algebraPoolAbi,
  functionName: 'token1',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"totalFeeGrowth0Token"`
 */
export const useReadAlgebraPoolTotalFeeGrowth0Token =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraPoolAbi,
    functionName: 'totalFeeGrowth0Token',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"totalFeeGrowth1Token"`
 */
export const useReadAlgebraPoolTotalFeeGrowth1Token =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraPoolAbi,
    functionName: 'totalFeeGrowth1Token',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__
 */
export const useWriteAlgebraPool = /*#__PURE__*/ createUseWriteContract({
  abi: algebraPoolAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"burn"`
 */
export const useWriteAlgebraPoolBurn = /*#__PURE__*/ createUseWriteContract({
  abi: algebraPoolAbi,
  functionName: 'burn',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"collect"`
 */
export const useWriteAlgebraPoolCollect = /*#__PURE__*/ createUseWriteContract({
  abi: algebraPoolAbi,
  functionName: 'collect',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"flash"`
 */
export const useWriteAlgebraPoolFlash = /*#__PURE__*/ createUseWriteContract({
  abi: algebraPoolAbi,
  functionName: 'flash',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"initialize"`
 */
export const useWriteAlgebraPoolInitialize =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraPoolAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"mint"`
 */
export const useWriteAlgebraPoolMint = /*#__PURE__*/ createUseWriteContract({
  abi: algebraPoolAbi,
  functionName: 'mint',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setCommunityFee"`
 */
export const useWriteAlgebraPoolSetCommunityFee =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraPoolAbi,
    functionName: 'setCommunityFee',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setFee"`
 */
export const useWriteAlgebraPoolSetFee = /*#__PURE__*/ createUseWriteContract({
  abi: algebraPoolAbi,
  functionName: 'setFee',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setPlugin"`
 */
export const useWriteAlgebraPoolSetPlugin =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraPoolAbi,
    functionName: 'setPlugin',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setPluginConfig"`
 */
export const useWriteAlgebraPoolSetPluginConfig =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraPoolAbi,
    functionName: 'setPluginConfig',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setTickSpacing"`
 */
export const useWriteAlgebraPoolSetTickSpacing =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraPoolAbi,
    functionName: 'setTickSpacing',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"swap"`
 */
export const useWriteAlgebraPoolSwap = /*#__PURE__*/ createUseWriteContract({
  abi: algebraPoolAbi,
  functionName: 'swap',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"swapWithPaymentInAdvance"`
 */
export const useWriteAlgebraPoolSwapWithPaymentInAdvance =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraPoolAbi,
    functionName: 'swapWithPaymentInAdvance',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__
 */
export const useSimulateAlgebraPool = /*#__PURE__*/ createUseSimulateContract({
  abi: algebraPoolAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"burn"`
 */
export const useSimulateAlgebraPoolBurn =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'burn',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"collect"`
 */
export const useSimulateAlgebraPoolCollect =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'collect',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"flash"`
 */
export const useSimulateAlgebraPoolFlash =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'flash',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"initialize"`
 */
export const useSimulateAlgebraPoolInitialize =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'initialize',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"mint"`
 */
export const useSimulateAlgebraPoolMint =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'mint',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setCommunityFee"`
 */
export const useSimulateAlgebraPoolSetCommunityFee =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'setCommunityFee',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setFee"`
 */
export const useSimulateAlgebraPoolSetFee =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'setFee',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setPlugin"`
 */
export const useSimulateAlgebraPoolSetPlugin =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'setPlugin',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setPluginConfig"`
 */
export const useSimulateAlgebraPoolSetPluginConfig =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'setPluginConfig',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"setTickSpacing"`
 */
export const useSimulateAlgebraPoolSetTickSpacing =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'setTickSpacing',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"swap"`
 */
export const useSimulateAlgebraPoolSwap =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'swap',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraPoolAbi}__ and `functionName` set to `"swapWithPaymentInAdvance"`
 */
export const useSimulateAlgebraPoolSwapWithPaymentInAdvance =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraPoolAbi,
    functionName: 'swapWithPaymentInAdvance',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__
 */
export const useWatchAlgebraPoolEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: algebraPoolAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Burn"`
 */
export const useWatchAlgebraPoolBurnEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Burn',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Collect"`
 */
export const useWatchAlgebraPoolCollectEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Collect',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"CommunityFee"`
 */
export const useWatchAlgebraPoolCommunityFeeEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'CommunityFee',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Fee"`
 */
export const useWatchAlgebraPoolFeeEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Fee',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Flash"`
 */
export const useWatchAlgebraPoolFlashEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Flash',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Initialize"`
 */
export const useWatchAlgebraPoolInitializeEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Initialize',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Mint"`
 */
export const useWatchAlgebraPoolMintEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Mint',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Plugin"`
 */
export const useWatchAlgebraPoolPluginEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Plugin',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"PluginConfig"`
 */
export const useWatchAlgebraPoolPluginConfigEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'PluginConfig',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"Swap"`
 */
export const useWatchAlgebraPoolSwapEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'Swap',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link algebraPoolAbi}__ and `eventName` set to `"TickSpacing"`
 */
export const useWatchAlgebraPoolTickSpacingEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: algebraPoolAbi,
    eventName: 'TickSpacing',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraRouterAbi}__
 */
export const useReadAlgebraRouter = /*#__PURE__*/ createUseReadContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"WNativeToken"`
 */
export const useReadAlgebraRouterWNativeToken =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'WNativeToken',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"factory"`
 */
export const useReadAlgebraRouterFactory = /*#__PURE__*/ createUseReadContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
  functionName: 'factory',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"poolDeployer"`
 */
export const useReadAlgebraRouterPoolDeployer =
  /*#__PURE__*/ createUseReadContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'poolDeployer',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__
 */
export const useWriteAlgebraRouter = /*#__PURE__*/ createUseWriteContract({
  abi: algebraRouterAbi,
  address: algebraRouterAddress,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"algebraSwapCallback"`
 */
export const useWriteAlgebraRouterAlgebraSwapCallback =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'algebraSwapCallback',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInput"`
 */
export const useWriteAlgebraRouterExactInput =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactInput',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInputSingle"`
 */
export const useWriteAlgebraRouterExactInputSingle =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactInputSingle',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInputSingleSupportingFeeOnTransferTokens"`
 */
export const useWriteAlgebraRouterExactInputSingleSupportingFeeOnTransferTokens =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactInputSingleSupportingFeeOnTransferTokens',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactOutput"`
 */
export const useWriteAlgebraRouterExactOutput =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactOutput',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactOutputSingle"`
 */
export const useWriteAlgebraRouterExactOutputSingle =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactOutputSingle',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"multicall"`
 */
export const useWriteAlgebraRouterMulticall =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'multicall',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"refundNativeToken"`
 */
export const useWriteAlgebraRouterRefundNativeToken =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'refundNativeToken',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermit"`
 */
export const useWriteAlgebraRouterSelfPermit =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermit',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitAllowed"`
 */
export const useWriteAlgebraRouterSelfPermitAllowed =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitAllowed',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitAllowedIfNecessary"`
 */
export const useWriteAlgebraRouterSelfPermitAllowedIfNecessary =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitAllowedIfNecessary',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitIfNecessary"`
 */
export const useWriteAlgebraRouterSelfPermitIfNecessary =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitIfNecessary',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"sweepToken"`
 */
export const useWriteAlgebraRouterSweepToken =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'sweepToken',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"sweepTokenWithFee"`
 */
export const useWriteAlgebraRouterSweepTokenWithFee =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'sweepTokenWithFee',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"unwrapWNativeToken"`
 */
export const useWriteAlgebraRouterUnwrapWNativeToken =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'unwrapWNativeToken',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"unwrapWNativeTokenWithFee"`
 */
export const useWriteAlgebraRouterUnwrapWNativeTokenWithFee =
  /*#__PURE__*/ createUseWriteContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'unwrapWNativeTokenWithFee',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__
 */
export const useSimulateAlgebraRouter = /*#__PURE__*/ createUseSimulateContract(
  { abi: algebraRouterAbi, address: algebraRouterAddress },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"algebraSwapCallback"`
 */
export const useSimulateAlgebraRouterAlgebraSwapCallback =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'algebraSwapCallback',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInput"`
 */
export const useSimulateAlgebraRouterExactInput =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactInput',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInputSingle"`
 */
export const useSimulateAlgebraRouterExactInputSingle =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactInputSingle',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactInputSingleSupportingFeeOnTransferTokens"`
 */
export const useSimulateAlgebraRouterExactInputSingleSupportingFeeOnTransferTokens =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactInputSingleSupportingFeeOnTransferTokens',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactOutput"`
 */
export const useSimulateAlgebraRouterExactOutput =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactOutput',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"exactOutputSingle"`
 */
export const useSimulateAlgebraRouterExactOutputSingle =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'exactOutputSingle',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"multicall"`
 */
export const useSimulateAlgebraRouterMulticall =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'multicall',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"refundNativeToken"`
 */
export const useSimulateAlgebraRouterRefundNativeToken =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'refundNativeToken',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermit"`
 */
export const useSimulateAlgebraRouterSelfPermit =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermit',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitAllowed"`
 */
export const useSimulateAlgebraRouterSelfPermitAllowed =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitAllowed',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitAllowedIfNecessary"`
 */
export const useSimulateAlgebraRouterSelfPermitAllowedIfNecessary =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitAllowedIfNecessary',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"selfPermitIfNecessary"`
 */
export const useSimulateAlgebraRouterSelfPermitIfNecessary =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'selfPermitIfNecessary',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"sweepToken"`
 */
export const useSimulateAlgebraRouterSweepToken =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'sweepToken',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"sweepTokenWithFee"`
 */
export const useSimulateAlgebraRouterSweepTokenWithFee =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'sweepTokenWithFee',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"unwrapWNativeToken"`
 */
export const useSimulateAlgebraRouterUnwrapWNativeToken =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'unwrapWNativeToken',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link algebraRouterAbi}__ and `functionName` set to `"unwrapWNativeTokenWithFee"`
 */
export const useSimulateAlgebraRouterUnwrapWNativeTokenWithFee =
  /*#__PURE__*/ createUseSimulateContract({
    abi: algebraRouterAbi,
    address: algebraRouterAddress,
    functionName: 'unwrapWNativeTokenWithFee',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link pegSwapAbi}__
 */
export const useReadPegSwap = /*#__PURE__*/ createUseReadContract({
  abi: pegSwapAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"getSwappableAmount"`
 */
export const useReadPegSwapGetSwappableAmount =
  /*#__PURE__*/ createUseReadContract({
    abi: pegSwapAbi,
    functionName: 'getSwappableAmount',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"owner"`
 */
export const useReadPegSwapOwner = /*#__PURE__*/ createUseReadContract({
  abi: pegSwapAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link pegSwapAbi}__
 */
export const useWritePegSwap = /*#__PURE__*/ createUseWriteContract({
  abi: pegSwapAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"acceptOwnership"`
 */
export const useWritePegSwapAcceptOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: pegSwapAbi,
    functionName: 'acceptOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"addLiquidity"`
 */
export const useWritePegSwapAddLiquidity = /*#__PURE__*/ createUseWriteContract(
  { abi: pegSwapAbi, functionName: 'addLiquidity' },
)

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"onTokenTransfer"`
 */
export const useWritePegSwapOnTokenTransfer =
  /*#__PURE__*/ createUseWriteContract({
    abi: pegSwapAbi,
    functionName: 'onTokenTransfer',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"recoverStuckTokens"`
 */
export const useWritePegSwapRecoverStuckTokens =
  /*#__PURE__*/ createUseWriteContract({
    abi: pegSwapAbi,
    functionName: 'recoverStuckTokens',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"removeLiquidity"`
 */
export const useWritePegSwapRemoveLiquidity =
  /*#__PURE__*/ createUseWriteContract({
    abi: pegSwapAbi,
    functionName: 'removeLiquidity',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"swap"`
 */
export const useWritePegSwapSwap = /*#__PURE__*/ createUseWriteContract({
  abi: pegSwapAbi,
  functionName: 'swap',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useWritePegSwapTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: pegSwapAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link pegSwapAbi}__
 */
export const useSimulatePegSwap = /*#__PURE__*/ createUseSimulateContract({
  abi: pegSwapAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"acceptOwnership"`
 */
export const useSimulatePegSwapAcceptOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: pegSwapAbi,
    functionName: 'acceptOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"addLiquidity"`
 */
export const useSimulatePegSwapAddLiquidity =
  /*#__PURE__*/ createUseSimulateContract({
    abi: pegSwapAbi,
    functionName: 'addLiquidity',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"onTokenTransfer"`
 */
export const useSimulatePegSwapOnTokenTransfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: pegSwapAbi,
    functionName: 'onTokenTransfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"recoverStuckTokens"`
 */
export const useSimulatePegSwapRecoverStuckTokens =
  /*#__PURE__*/ createUseSimulateContract({
    abi: pegSwapAbi,
    functionName: 'recoverStuckTokens',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"removeLiquidity"`
 */
export const useSimulatePegSwapRemoveLiquidity =
  /*#__PURE__*/ createUseSimulateContract({
    abi: pegSwapAbi,
    functionName: 'removeLiquidity',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"swap"`
 */
export const useSimulatePegSwapSwap = /*#__PURE__*/ createUseSimulateContract({
  abi: pegSwapAbi,
  functionName: 'swap',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link pegSwapAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useSimulatePegSwapTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: pegSwapAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__
 */
export const useWatchPegSwapEvent = /*#__PURE__*/ createUseWatchContractEvent({
  abi: pegSwapAbi,
})

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__ and `eventName` set to `"LiquidityUpdated"`
 */
export const useWatchPegSwapLiquidityUpdatedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: pegSwapAbi,
    eventName: 'LiquidityUpdated',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__ and `eventName` set to `"OwnershipTransferRequested"`
 */
export const useWatchPegSwapOwnershipTransferRequestedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: pegSwapAbi,
    eventName: 'OwnershipTransferRequested',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const useWatchPegSwapOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: pegSwapAbi,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__ and `eventName` set to `"StuckTokensRecovered"`
 */
export const useWatchPegSwapStuckTokensRecoveredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: pegSwapAbi,
    eventName: 'StuckTokensRecovered',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link pegSwapAbi}__ and `eventName` set to `"TokensSwapped"`
 */
export const useWatchPegSwapTokensSwappedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: pegSwapAbi,
    eventName: 'TokensSwapped',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link wrappedNativeAbi}__
 */
export const useReadWrappedNative = /*#__PURE__*/ createUseReadContract({
  abi: wrappedNativeAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"name"`
 */
export const useReadWrappedNativeName = /*#__PURE__*/ createUseReadContract({
  abi: wrappedNativeAbi,
  functionName: 'name',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"totalSupply"`
 */
export const useReadWrappedNativeTotalSupply =
  /*#__PURE__*/ createUseReadContract({
    abi: wrappedNativeAbi,
    functionName: 'totalSupply',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"decimals"`
 */
export const useReadWrappedNativeDecimals = /*#__PURE__*/ createUseReadContract(
  { abi: wrappedNativeAbi, functionName: 'decimals' },
)

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"balanceOf"`
 */
export const useReadWrappedNativeBalanceOf =
  /*#__PURE__*/ createUseReadContract({
    abi: wrappedNativeAbi,
    functionName: 'balanceOf',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"symbol"`
 */
export const useReadWrappedNativeSymbol = /*#__PURE__*/ createUseReadContract({
  abi: wrappedNativeAbi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"allowance"`
 */
export const useReadWrappedNativeAllowance =
  /*#__PURE__*/ createUseReadContract({
    abi: wrappedNativeAbi,
    functionName: 'allowance',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link wrappedNativeAbi}__
 */
export const useWriteWrappedNative = /*#__PURE__*/ createUseWriteContract({
  abi: wrappedNativeAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"approve"`
 */
export const useWriteWrappedNativeApprove =
  /*#__PURE__*/ createUseWriteContract({
    abi: wrappedNativeAbi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"transferFrom"`
 */
export const useWriteWrappedNativeTransferFrom =
  /*#__PURE__*/ createUseWriteContract({
    abi: wrappedNativeAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"withdraw"`
 */
export const useWriteWrappedNativeWithdraw =
  /*#__PURE__*/ createUseWriteContract({
    abi: wrappedNativeAbi,
    functionName: 'withdraw',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"transfer"`
 */
export const useWriteWrappedNativeTransfer =
  /*#__PURE__*/ createUseWriteContract({
    abi: wrappedNativeAbi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"deposit"`
 */
export const useWriteWrappedNativeDeposit =
  /*#__PURE__*/ createUseWriteContract({
    abi: wrappedNativeAbi,
    functionName: 'deposit',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__
 */
export const useSimulateWrappedNative = /*#__PURE__*/ createUseSimulateContract(
  { abi: wrappedNativeAbi },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"approve"`
 */
export const useSimulateWrappedNativeApprove =
  /*#__PURE__*/ createUseSimulateContract({
    abi: wrappedNativeAbi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"transferFrom"`
 */
export const useSimulateWrappedNativeTransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: wrappedNativeAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"withdraw"`
 */
export const useSimulateWrappedNativeWithdraw =
  /*#__PURE__*/ createUseSimulateContract({
    abi: wrappedNativeAbi,
    functionName: 'withdraw',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"transfer"`
 */
export const useSimulateWrappedNativeTransfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: wrappedNativeAbi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link wrappedNativeAbi}__ and `functionName` set to `"deposit"`
 */
export const useSimulateWrappedNativeDeposit =
  /*#__PURE__*/ createUseSimulateContract({
    abi: wrappedNativeAbi,
    functionName: 'deposit',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link wrappedNativeAbi}__
 */
export const useWatchWrappedNativeEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: wrappedNativeAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link wrappedNativeAbi}__ and `eventName` set to `"Approval"`
 */
export const useWatchWrappedNativeApprovalEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: wrappedNativeAbi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link wrappedNativeAbi}__ and `eventName` set to `"Transfer"`
 */
export const useWatchWrappedNativeTransferEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: wrappedNativeAbi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link wrappedNativeAbi}__ and `eventName` set to `"Deposit"`
 */
export const useWatchWrappedNativeDepositEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: wrappedNativeAbi,
    eventName: 'Deposit',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link wrappedNativeAbi}__ and `eventName` set to `"Withdrawal"`
 */
export const useWatchWrappedNativeWithdrawalEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: wrappedNativeAbi,
    eventName: 'Withdrawal',
  })
