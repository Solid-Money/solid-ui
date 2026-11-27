/// <reference types="jest" />

import { Address, decodeFunctionData, erc20Abi, toFunctionSelector } from 'viem';

import BridgePayamster_ABI from '@/lib/abis/BridgePayamster';
import { ADDRESSES } from '@/lib/config';
import {
  BASE_LZ_EID,
  buildFuseMigrationBatches,
  buildFuseMigrationItems,
  confirmedDepositAddress,
  deliveredVaultActivities,
  followVaultDeliveries,
  formatMigrationAmount,
  FuseMigrationAsset,
  movableFuseMigrationUsd,
} from '@/lib/fuseMigration';

const USDC = '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9' as Address;
const USDT = '0x3695Dd1D1D43B794C0B13eb8be8419Eb3ac22bf7' as Address;
const SOUSD = '0x75333830E7014e909535389a6E5b0C02aA62ca27' as Address;
const SOUSD_TELLER = '0x220d4667AA06E0Aa39f62c601690848f2e48BC15' as Address;
const NO_MINIMUM = { [SOUSD_TELLER.toLowerCase()]: 0n };
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
    expect(items[0]).toMatchObject({
      symbol: 'soUSD',
      movable: false,
      minimum: 100_000n,
      stays: 'below_minimum',
    });
    expect(movableFuseMigrationUsd(items)).toBe(0);
  });

  // Taking an unknown minimum as zero would let a sub-minimum vault into the operation with the
  // stablecoins, and the paymaster's revert would then sink the whole operation.
  it('holds back a vault whose minimum could not be read, and still moves the stablecoins', () => {
    const items = buildFuseMigrationItems(ASSETS, [10_000_000n, 2_500_000n], {}, {});
    expect(items.map(item => [item.symbol, item.movable, item.stays])).toEqual([
      ['USDC', true, undefined],
      ['soUSD', false, 'minimum_unknown'],
    ]);
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
  const items = buildFuseMigrationItems(ASSETS, [10_000_000n, 2_500_000n], NO_MINIMUM, {
    soUSD: 1.05,
  });

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
      NO_MINIMUM,
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

describe('deliveredVaultActivities', () => {
  const SOETH_TELLER = '0xEaac000000000000000000000000000000000001' as Address;
  const rows = [
    { id: 'sousd-row', teller: SOUSD_TELLER },
    { id: 'soeth-row', teller: SOETH_TELLER },
  ];
  const message = (status: string, sender?: Address) => ({
    status: { name: status },
    ...(sender ? { pathway: { sender: { address: sender.toLowerCase() } } } : {}),
  });

  it('marks only the vault whose own message was delivered', () => {
    expect(
      deliveredVaultActivities(
        [message('DELIVERED', SOUSD_TELLER), message('BLOCKED', SOETH_TELLER)],
        rows,
      ),
    ).toEqual(['sousd-row']);
  });

  it('marks a single vault once its message is delivered', () => {
    expect(deliveredVaultActivities([message('DELIVERED', SOUSD_TELLER)], [rows[0]])).toEqual([
      'sousd-row',
    ]);
  });

  it('without senders, marks rows only when every message, one per row, was delivered', () => {
    expect(deliveredVaultActivities([message('DELIVERED'), message('FAILED')], rows)).toEqual([]);
    expect(deliveredVaultActivities([message('DELIVERED')], rows)).toEqual([]);
    expect(deliveredVaultActivities([message('DELIVERED'), message('DELIVERED')], rows)).toEqual([
      'sousd-row',
      'soeth-row',
    ]);
  });

  it('marks nothing before LayerZero has indexed the transaction', () => {
    expect(deliveredVaultActivities([], rows)).toEqual([]);
    expect(deliveredVaultActivities(undefined, rows)).toEqual([]);
  });
});

describe('followVaultDeliveries', () => {
  const SOETH_TELLER = '0xEaac000000000000000000000000000000000001' as Address;
  const rows = [
    { id: 'sousd-row', teller: SOUSD_TELLER },
    { id: 'soeth-row', teller: SOETH_TELLER },
  ];
  const message = (status: string, sender: Address) => ({
    status: { name: status },
    pathway: { sender: { address: sender.toLowerCase() } },
  });
  const follow = (responses: unknown[], rounds = 5) => {
    const fetchMessages = jest.fn();
    responses.forEach(response =>
      response instanceof Error
        ? fetchMessages.mockRejectedValueOnce(response)
        : fetchMessages.mockResolvedValueOnce(response),
    );
    fetchMessages.mockResolvedValue(responses[responses.length - 1]);
    const onDelivered = jest.fn();
    const wait = jest.fn(() => Promise.resolve());
    return {
      fetchMessages,
      onDelivered,
      result: followVaultDeliveries({
        activities: rows,
        fetchMessages,
        onDelivered,
        wait,
        rounds,
      }),
    };
  };

  // The scan API can list soUSD's message before it has indexed soETH's.
  it('keeps polling for a vault whose message was not indexed yet', async () => {
    const { onDelivered, fetchMessages, result } = follow([
      [message('DELIVERED', SOUSD_TELLER)],
      [message('DELIVERED', SOUSD_TELLER), message('INFLIGHT', SOETH_TELLER)],
      [message('DELIVERED', SOUSD_TELLER), message('DELIVERED', SOETH_TELLER)],
    ]);

    await expect(result).resolves.toEqual([]);
    expect(onDelivered.mock.calls.map(([id]) => id)).toEqual(['sousd-row', 'soeth-row']);
    expect(fetchMessages).toHaveBeenCalledTimes(3);
  });

  // soUSD was matched by sender earlier; a later sender-less response holding only that one
  // delivered message must not be taken as soETH's.
  it('never marks a pending vault from a sender-less response short of one message per row', async () => {
    const senderless = { status: { name: 'DELIVERED' } };
    const { onDelivered, result } = follow(
      [[message('DELIVERED', SOUSD_TELLER), message('INFLIGHT', SOETH_TELLER)], [senderless]],
      4,
    );

    await expect(result).resolves.toEqual(['soeth-row']);
    expect(onDelivered.mock.calls.map(([id]) => id)).toEqual(['sousd-row']);
  });

  it('stops following a vault whose message failed, without marking it', async () => {
    const { onDelivered, fetchMessages, result } = follow([
      [message('DELIVERED', SOUSD_TELLER), message('FAILED', SOETH_TELLER)],
    ]);

    await expect(result).resolves.toEqual([]);
    expect(onDelivered.mock.calls.map(([id]) => id)).toEqual(['sousd-row']);
    expect(fetchMessages).toHaveBeenCalledTimes(1);
  });

  it('survives a failed fetch and reports what never arrived', async () => {
    const { onDelivered, result } = follow(
      [new Error('scan down'), [message('DELIVERED', SOUSD_TELLER)]],
      3,
    );

    await expect(result).resolves.toEqual(['soeth-row']);
    expect(onDelivered.mock.calls.map(([id]) => id)).toEqual(['sousd-row']);
  });
});

describe('confirmedDepositAddress', () => {
  it('returns the address when the server says it delivers to the migrating Safe', () => {
    expect(
      confirmedDepositAddress(
        { walletAddress: DEPOSIT, safeAddress: SAFE.toUpperCase().replace('0X', '0x') },
        SAFE,
      ),
    ).toBe(DEPOSIT);
  });

  // A web session cookie switched to another account by a second tab.
  it("refuses an address that delivers to another account's Safe", () => {
    expect(() =>
      confirmedDepositAddress(
        { walletAddress: DEPOSIT, safeAddress: '0x3333333333333333333333333333333333333333' },
        SAFE,
      ),
    ).toThrow('Nothing was moved');
  });

  it('refuses a response that does not name the Safe, or has no address', () => {
    expect(() => confirmedDepositAddress({ walletAddress: DEPOSIT }, SAFE)).toThrow();
    expect(() => confirmedDepositAddress({ safeAddress: SAFE }, SAFE)).toThrow();
    expect(() => confirmedDepositAddress(undefined, SAFE)).toThrow();
  });
});
