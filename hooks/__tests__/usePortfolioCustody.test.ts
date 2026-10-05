import { parseUnits } from 'viem';

import { clearCustodyTokenMetadata, readPortfolioCustody } from '@/hooks/usePortfolioCustody';

const mockRead = jest.fn();
const mockMulticall = jest.fn();
jest.mock('@/lib/wagmi', () => ({
  publicClient: () => ({ readContract: mockRead, multicall: mockMulticall }),
}));

const safe = '0x1111111111111111111111111111111111111111';
const lock = '0x2222222222222222222222222222222222222222';
const moduleAddress = '0x3333333333333333333333333333333333333333';
const retiredModule = '0x5555555555555555555555555555555555555555';
const asset = '0x4444444444444444444444444444444444444444';

beforeEach(() => {
  jest.resetAllMocks();
  clearCustodyTokenMetadata();
});

it('reads locked underlying FUSE, including matured shares still in custody, without adding them twice', async () => {
  mockRead.mockResolvedValue(parseUnits('10000', 18));
  const result = await readPortfolioCustody(safe, lock, []);
  expect(result.lockedFuse).toBe(10000);
  expect(mockRead).toHaveBeenCalledWith(
    expect.objectContaining({ address: lock, functionName: 'lockedAssetsOf', args: [safe] }),
  );
  expect(mockRead).toHaveBeenCalledTimes(1);
});

it('reads debt including interest and values collateral using the module price', async () => {
  mockMulticall
    .mockResolvedValueOnce([[asset], parseUnits('350.12', 6)])
    .mockResolvedValueOnce([parseUnits('2', 18)])
    .mockResolvedValueOnce(['soETH', 18])
    .mockResolvedValueOnce([[parseUnits('4400', 6), true, true]]);
  const result = await readPortfolioCustody(safe, null, [moduleAddress]);
  expect(result.debtUsd).toBeCloseTo(350.12);
  expect(result.collateral[0]).toMatchObject({
    balance: parseUnits('2', 18).toString(),
    quoteRate: 4400,
    contractDecimals: 18,
  });
});

it('leaves unusable collateral prices unknown', async () => {
  mockMulticall
    .mockResolvedValueOnce([[asset], 1n])
    .mockResolvedValueOnce([1n])
    .mockResolvedValueOnce(['USDC', 6])
    .mockResolvedValueOnce([[1000000n, false, true]]);
  expect(
    (await readPortfolioCustody(safe, null, [moduleAddress])).collateral[0].quoteRate,
  ).toBeUndefined();
});

it('rejects failed reads instead of reporting a zero holding', async () => {
  mockRead.mockRejectedValue(new Error('RPC unavailable'));
  await expect(readPortfolioCustody(safe, lock, [])).rejects.toThrow('RPC unavailable');
});

it('skips unconfigured custody contracts and confirms zero for those sources', async () => {
  expect(await readPortfolioCustody(safe, null, [])).toEqual({
    lockedFuse: 0,
    collateral: [],
    debtUsd: 0,
  });
  expect(mockRead).not.toHaveBeenCalled();
  expect(mockMulticall).not.toHaveBeenCalled();
});
it('includes separate current and retired custody once, even when a module is repeated', async () => {
  mockMulticall.mockImplementation(async ({ contracts }) => {
    if (contracts[0].functionName === 'allowedTokens')
      return [[asset], parseUnits(contracts[0].address === moduleAddress ? '200' : '150', 6)];
    if (contracts[0].functionName === 'collateralOf') return [1000000n];
    if (contracts[0].functionName === 'symbol') return ['USDC', 6];
    return [[1000000n, true, true]];
  });
  const result = await readPortfolioCustody(safe, null, [
    moduleAddress,
    retiredModule,
    moduleAddress,
  ]);
  expect(result.debtUsd).toBe(350);
  expect(result.collateral).toHaveLength(2);
  expect(result.collateral.map(token => token.balance)).toEqual(['1000000', '1000000']);
});
it('does not silently drop an unreadable retired position', async () => {
  mockMulticall.mockImplementation(async ({ contracts }) => {
    if (contracts[0].address === retiredModule) throw new Error('Retired custody unavailable');
    return [[], 0n];
  });
  await expect(readPortfolioCustody(safe, null, [moduleAddress, retiredModule])).rejects.toThrow(
    'Retired custody unavailable',
  );
});

it('reads token symbol and decimals once, then only prices on later polls', async () => {
  const calls: string[] = [];
  mockMulticall.mockImplementation(async ({ contracts }) => {
    calls.push(contracts[0].functionName);
    if (contracts[0].functionName === 'allowedTokens') return [[asset], 0n];
    if (contracts[0].functionName === 'collateralOf') return [1000000n];
    if (contracts[0].functionName === 'symbol') return ['USDC', 6];
    return [[1000000n, true, true]];
  });
  await readPortfolioCustody(safe, null, [moduleAddress]);
  await readPortfolioCustody(safe, null, [moduleAddress]);
  expect(calls.filter(name => name === 'symbol')).toHaveLength(1);
  expect(calls.filter(name => name === 'getPriceUsd')).toHaveLength(2);
});
