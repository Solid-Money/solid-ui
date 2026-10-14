/// <reference types="jest" />
import { ActivityEvent, SwapTokenResponse, TransactionStatus, TransactionType } from '@/lib/types';
import { isUnlistedTokenReceive, toListedTokens } from '@/lib/utils/tokenAllowlist';

const BASE = 8453;
const FUSE = 122;
/** USDC on Base, stored checksummed in the swap-tokens list. */
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
/** ZORRA, airdropped to Safes on Base. */
const ZORRA_BASE = '0xba42a3f0b0dbadeeaa974c1d30dd46abc7845468';

const listed = toListedTokens([{ address: USDC_BASE, chainId: BASE } as SwapTokenResponse]);

const receive = (overrides: Partial<ActivityEvent> = {}): ActivityEvent => ({
  clientTxId: 'blockscout_8453_0xhash_incoming',
  title: 'Receive ZORRA',
  type: TransactionType.RECEIVE,
  status: TransactionStatus.SUCCESS,
  amount: '10.0',
  symbol: 'ZORRA',
  timestamp: '1791902917',
  chainId: BASE,
  metadata: { source: 'blockscout', tokenAddress: ZORRA_BASE },
  ...overrides,
});

describe('isUnlistedTokenReceive', () => {
  it('flags an airdropped token that is not on the list', () => {
    expect(isUnlistedTokenReceive(receive(), listed)).toBe(true);
  });

  it('keeps a listed token, whatever the address case', () => {
    expect(
      isUnlistedTokenReceive(
        receive({ symbol: 'USDC', metadata: { tokenAddress: USDC_BASE.toLowerCase() } }),
        listed,
      ),
    ).toBe(false);
  });

  it('matches on chain as well as address', () => {
    expect(
      isUnlistedTokenReceive(
        receive({ chainId: FUSE, metadata: { tokenAddress: USDC_BASE } }),
        listed,
      ),
    ).toBe(true);
  });

  it('judges the address, not the symbol', () => {
    // A fake USDC is still a fake.
    expect(isUnlistedTokenReceive(receive({ symbol: 'USDC' }), listed)).toBe(true);
  });

  it('leaves native currency, sends and rows without a token address alone', () => {
    expect(
      isUnlistedTokenReceive(
        receive({ metadata: { tokenAddress: '0x0000000000000000000000000000000000000000' } }),
        listed,
      ),
    ).toBe(false);
    expect(isUnlistedTokenReceive(receive({ type: TransactionType.SEND }), listed)).toBe(false);
    expect(isUnlistedTokenReceive(receive({ metadata: {} }), listed)).toBe(false);
    expect(isUnlistedTokenReceive(receive({ chainId: undefined }), listed)).toBe(false);
  });

  it('filters nothing when there is no list', () => {
    expect(isUnlistedTokenReceive(receive(), null)).toBe(false);
    expect(toListedTokens([])).toBeNull();
    expect(toListedTokens(undefined)).toBeNull();
  });
});
