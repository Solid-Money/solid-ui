/// <reference types="jest" />

import { Address, decodeFunctionData, erc20Abi, toFunctionSelector } from 'viem';

import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import { ADDRESSES } from '@/lib/config';
import {
  BASE_LZ_EID,
  buildFuseMigrationBatches,
  buildFuseMigrationItems,
  formatMigrationAmount,
  FuseMigrationAsset,
  movableFuseMigrationUsd,
} from '@/lib/fuseMigration';

const USDC = '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9' as Address;
const USDT = '0x3695Dd1D1D43B794C0B13eb8be8419Eb3ac22bf7' as Address;
const SOUSD = '0x75333830E7014e909535389a6E5b0C02aA62ca27' as Address;
const SOUSD_TELLER = '0x220d4667AA06E0Aa39f62c601690848f2e48BC15' as Address;
const SAFE = '0x1111111111111111111111111111111111111111' as Address;
const DEPOSIT = '0x2222222222222222222222222222222222222222' as Address;

const ASSETS: FuseMigrationAsset[] = [
  { symbol: 'USDC', token: USDC, decimals: 6, route: 'deposit_address' },
  {
    symbol: 'soUSD',
    token: SOUSD,
    decimals: 6,
    route: 'vault_bridge',
    teller: SOUSD_TELLER,
  },
];

describe('buildFuseMigrationItems', () => {
  it('drops zero balances and prices stablecoins at $1 by default', () => {
    const items = buildFuseMigrationItems(ASSETS, [10_000_000n, 0n], {}, {});
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ symbol: 'USDC', valueUsd: 10, movable: true, minimum: 0n });
  });

  it('keeps vault shares below the paymaster minimum on Fuse', () => {
    const items = buildFuseMigrationItems(
      ASSETS,
      [0n, 50_000n],
      { [SOUSD_TELLER.toLowerCase()]: 100_000n },
      { soUSD: 1.05 },
    );
    expect(items[0]).toMatchObject({ symbol: 'soUSD', movable: false, minimum: 100_000n });
    expect(movableFuseMigrationUsd(items)).toBe(0);
  });

  it('never applies a minimum to stablecoins, which the backend moves at any size', () => {
    const items = buildFuseMigrationItems(
      ASSETS,
      [10_000n, 0n],
      { [SOUSD_TELLER.toLowerCase()]: 100_000n },
      {},
    );
    expect(items[0]).toMatchObject({ symbol: 'USDC', movable: true });
  });
});

describe('buildFuseMigrationBatches', () => {
  const items = buildFuseMigrationItems(ASSETS, [10_000_000n, 2_500_000n], {}, { soUSD: 1.05 });

  it('bridges shares to the Base Safe and transfers a stablecoin to the deposit address', () => {
    const batches = buildFuseMigrationBatches({
      items,
      baseSafeAddress: SAFE,
      depositAddress: DEPOSIT,
    });
    expect(batches).toHaveLength(1);
    const { calls } = batches[0];
    expect(calls).toHaveLength(3);

    const approve = decodeFunctionData({ abi: erc20Abi, data: calls[0].data });
    expect(calls[0].to).toBe(SOUSD);
    expect(approve).toMatchObject({
      functionName: 'approve',
      args: [ADDRESSES.fuse.bridgePaymasterAddress, 2_500_000n],
    });

    const bridge = decodeFunctionData({ abi: BridgePayamster_ABI, data: calls[1].data });
    expect(calls[1].to).toBe(ADDRESSES.fuse.bridgePaymasterAddress);
    expect(bridge.functionName).toBe('sponsorBridge');
    expect(bridge.args?.slice(0, 3)).toEqual([SOUSD_TELLER, 2_500_000n, SAFE]);
    expect(BigInt(bridge.args?.[3] as string)).toBe(BigInt(BASE_LZ_EID));

    const transfer = decodeFunctionData({ abi: erc20Abi, data: calls[2].data });
    expect(calls[2].to).toBe(USDC);
    expect(transfer).toMatchObject({ functionName: 'transfer', args: [DEPOSIT, 10_000_000n] });
  });

  // The backend opens one deposit session per transaction, so a second stablecoin sent in the
  // same one would never be picked up.
  it('sends each stablecoin to the deposit address in its own operation', () => {
    const withUsdt = buildFuseMigrationItems(
      [...ASSETS, { symbol: 'USDT', token: USDT, decimals: 6, route: 'deposit_address' }],
      [10_000_000n, 2_500_000n, 4_000_000n],
      {},
      {},
    );
    const batches = buildFuseMigrationBatches({
      items: withUsdt,
      baseSafeAddress: SAFE,
      depositAddress: DEPOSIT,
    });

    expect(batches.map(batch => batch.items.map(item => item.symbol))).toEqual([
      ['soUSD', 'USDC'],
      ['USDT'],
    ]);
    batches.forEach(batch => {
      const transfers = batch.calls.filter(call =>
        call.data.startsWith(toFunctionSelector('transfer(address,uint256)')),
      );
      expect(transfers).toHaveLength(1);
    });
  });

  it('refuses to build a stablecoin move without a deposit address', () => {
    expect(() => buildFuseMigrationBatches({ items, baseSafeAddress: SAFE })).toThrow(
      'No deposit address',
    );
  });

  it('leaves below-minimum shares out of the operation', () => {
    const withMinimum = buildFuseMigrationItems(
      ASSETS,
      [10_000_000n, 50_000n],
      { [SOUSD_TELLER.toLowerCase()]: 100_000n },
      {},
    );
    const batches = buildFuseMigrationBatches({
      items: withMinimum,
      baseSafeAddress: SAFE,
      depositAddress: DEPOSIT,
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].calls).toHaveLength(1);
    expect(batches[0].calls[0].to).toBe(USDC);
  });
});

describe('formatMigrationAmount', () => {
  it('trims stablecoins to cents and shares to six places', () => {
    expect(formatMigrationAmount({ amount: 10_129_999n, decimals: 6 })).toBe('10.12');
    expect(formatMigrationAmount({ amount: 10_000_000n, decimals: 6 })).toBe('10');
    expect(formatMigrationAmount({ amount: 1_234_567_890_123_456_789n, decimals: 18 })).toBe(
      '1.234567',
    );
    expect(formatMigrationAmount({ amount: 1n, decimals: 6 })).toBe('<0.01');
  });
});
