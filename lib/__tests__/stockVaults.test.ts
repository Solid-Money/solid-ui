import { base } from 'viem/chains';

import { STOCK_VAULTS } from '@/constants/stockVaults';
import { fetchTokenPricesByAddress } from '@/lib/api';
import { fetchStockVaultHoldings, stockVaultHolding } from '@/lib/stockVaults';
import { VaultType } from '@/lib/types';

const mockMulticall = jest.fn();
jest.mock('@/lib/wagmi', () => ({ publicClient: () => ({ multicall: mockMulticall }) }));
jest.mock('@/lib/api', () => ({ fetchTokenPricesByAddress: jest.fn() }));

const SAFE = '0x0000000000000000000000000000000000005afe';
const priceKey = (type: VaultType) =>
  `${base.id}:${STOCK_VAULTS.find(stock => stock.type === type)!.stockToken.address.toLowerCase()}`;

/** The multicall's answer: per vault its share balance, then its accountant rate. */
const answer = (balances: Partial<Record<VaultType, bigint>>, rates = {} as typeof balances) =>
  STOCK_VAULTS.flatMap(stock => [
    { status: 'success', result: balances[stock.type] ?? 0n },
    { status: 'success', result: rates[stock.type] ?? 100_000_000n },
  ]);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('stockVaultHolding', () => {
  it('values shares at the rate, in stock tokens and in dollars', () => {
    expect(stockVaultHolding(2, 1.05, 200)).toEqual({
      shares: 2,
      rate: 1.05,
      priceUsd: 200,
      underlying: 2.1,
      valueUsd: 420,
    });
  });

  it('is worth nothing for no shares, price or not', () => {
    expect(stockVaultHolding(0, 1, undefined)).toMatchObject({ underlying: 0, valueUsd: 0 });
  });

  // A held stock is never valued at a made-up price: unknown, not $0.
  it('leaves held shares unvalued without a price or a rate', () => {
    expect(stockVaultHolding(1, 1, undefined).valueUsd).toBeUndefined();
    expect(stockVaultHolding(1, undefined, 200)).toMatchObject({
      underlying: undefined,
      valueUsd: undefined,
    });
    expect(stockVaultHolding(undefined, 1, 200).valueUsd).toBeUndefined();
  });
});

describe('fetchStockVaultHoldings', () => {
  it('reads every vault in one multicall and prices only the stocks held', async () => {
    // 1.5 soAAPL at 1.02 AAPLc each; nothing else.
    mockMulticall.mockResolvedValue(
      answer({ [VaultType.AAPL]: 150_000_000n }, { [VaultType.AAPL]: 102_000_000n }),
    );
    jest.mocked(fetchTokenPricesByAddress).mockResolvedValue({ [priceKey(VaultType.AAPL)]: 230 });

    const holdings = await fetchStockVaultHoldings(SAFE);

    expect(mockMulticall).toHaveBeenCalledTimes(1);
    expect(mockMulticall.mock.calls[0][0].contracts).toHaveLength(STOCK_VAULTS.length * 2);
    expect(fetchTokenPricesByAddress).toHaveBeenCalledWith([
      { chainId: base.id, address: STOCK_VAULTS[0].stockToken.address },
    ]);
    expect(holdings[VaultType.AAPL].underlying).toBeCloseTo(1.53);
    expect(holdings[VaultType.AAPL].valueUsd).toBeCloseTo(1.53 * 230);
    expect(holdings[VaultType.NVDA]).toMatchObject({ shares: 0, valueUsd: 0 });
  });

  it('asks for no prices when nothing is held', async () => {
    mockMulticall.mockResolvedValue(answer({}));

    const holdings = await fetchStockVaultHoldings(SAFE);

    expect(fetchTokenPricesByAddress).not.toHaveBeenCalled();
    expect(Object.values(holdings).every(holding => holding.valueUsd === 0)).toBe(true);
  });

  it('leaves a vault whose read failed unknown, without touching the others', async () => {
    const results = answer({ [VaultType.MSFT]: 100_000_000n, [VaultType.META]: 100_000_000n });
    const msft = STOCK_VAULTS.findIndex(stock => stock.type === VaultType.MSFT);
    results[msft * 2] = { status: 'failure', result: 0n };
    mockMulticall.mockResolvedValue(results);
    jest.mocked(fetchTokenPricesByAddress).mockResolvedValue({ [priceKey(VaultType.META)]: 600 });

    const holdings = await fetchStockVaultHoldings(SAFE);

    expect(holdings[VaultType.MSFT]).toMatchObject({ shares: undefined, valueUsd: undefined });
    expect(holdings[VaultType.META].valueUsd).toBe(600);
  });
});
