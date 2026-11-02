import { base, mainnet } from 'viem/chains';

import {
  describeRhinoArrival,
  findRhinoRoute,
  formatDepositAddress,
  formatRhinoUsdLimits,
  getRhinoAddressErrorBody,
  getRhinoChainsForDestination,
  getRhinoDepositStatusView,
  getRhinoRejectMessage,
  isRhinoDepositOffered,
  isSameDepositAddress,
  isValidRhinoDepositAddress,
  pickRhinoDeposit,
  resolveRhinoTokenSymbol,
} from '@/lib/rhinoDeposit';

import type {
  RhinoDeposit,
  RhinoDepositAssetsResponse,
  RhinoDepositRoute,
  RhinoDestinationType,
} from '@/lib/types';

const EVM_ADDRESS = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
const TRON_ADDRESS = 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE';
const SOLANA_ADDRESS = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

const route = (
  destinationType: RhinoDestinationType,
  receiveSymbol: string,
  extra: Partial<RhinoDepositRoute> = {},
): RhinoDepositRoute => ({
  destinationType,
  receiveSymbol,
  receiveChainId: base.id,
  minimumUsd: 5,
  maximumUsd: 100000,
  ...extra,
});

/** The product rules, as the backend publishes them for three chains. */
const ASSETS: RhinoDepositAssetsResponse = {
  enabled: true,
  chains: [
    {
      chain: 'TRON',
      name: 'Tron',
      addressType: 'TRON',
      tokens: [
        {
          symbol: 'USDT',
          address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          routes: [
            route('WALLET', 'USDT'),
            route('RAIN_CARD', 'USDC'),
            route('PROTOCOL', 'USDC', { vault: 'soUSD' }),
          ],
        },
      ],
    },
    {
      chain: 'OPTIMISM',
      name: 'Optimism',
      addressType: 'EVM',
      tokens: [
        {
          symbol: 'USDC',
          address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
          routes: [
            route('WALLET', 'USDC'),
            route('RAIN_CARD', 'USDC'),
            route('PROTOCOL', 'USDC', { vault: 'soUSD' }),
          ],
        },
        {
          symbol: 'ETH',
          address: '0x0000000000000000000000000000000000000000',
          routes: [
            route('WALLET', 'ETH'),
            route('RAIN_CARD', 'USDC'),
            route('PROTOCOL', 'ETH', { vault: 'soETH', receiveChainId: mainnet.id }),
          ],
        },
        {
          symbol: 'EURC',
          address: '0x0000000000000000000000000000000000000001',
          // EURC is never converted, so it never goes to the card or soUSD.
          routes: [route('WALLET', 'EURC'), route('PROTOCOL', 'EURC', { vault: 'soEURC' })],
        },
      ],
    },
    {
      chain: 'SOLANA',
      name: 'Solana',
      addressType: 'SOL',
      tokens: [
        {
          symbol: 'USDC',
          address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          routes: [route('WALLET', 'USDC')],
        },
      ],
    },
  ],
};

const chainsOf = (chains: { chain: string }[]) => chains.map(chain => chain.chain);

describe('isRhinoDepositOffered', () => {
  it('needs both the rollout and a backend with rhino.fi configured', () => {
    expect(isRhinoDepositOffered(true, ASSETS)).toBe(true);
    expect(isRhinoDepositOffered(false, ASSETS)).toBe(false);
    expect(isRhinoDepositOffered(true, { enabled: false, chains: ASSETS.chains })).toBe(false);
    expect(isRhinoDepositOffered(true, undefined)).toBe(false);
  });
});

describe('getRhinoChainsForDestination', () => {
  it('lists the chains with a token paying out to the destination', () => {
    expect(chainsOf(getRhinoChainsForDestination(ASSETS, { destinationType: 'WALLET' }))).toEqual([
      'TRON',
      'OPTIMISM',
      'SOLANA',
    ]);
    // Solana only pays out to the wallet here.
    expect(
      chainsOf(getRhinoChainsForDestination(ASSETS, { destinationType: 'RAIN_CARD' })),
    ).toEqual(['TRON', 'OPTIMISM']);
    expect(chainsOf(getRhinoChainsForDestination(ASSETS, { destinationType: 'PROTOCOL' }))).toEqual(
      ['TRON', 'OPTIMISM'],
    );
  });

  it('narrows to the token already chosen', () => {
    expect(
      chainsOf(
        getRhinoChainsForDestination(ASSETS, { destinationType: 'RAIN_CARD', symbol: 'USDT' }),
      ),
    ).toEqual(['TRON']);
    expect(
      chainsOf(getRhinoChainsForDestination(ASSETS, { destinationType: 'WALLET', symbol: 'USDC' })),
    ).toEqual(['OPTIMISM', 'SOLANA']);
  });

  it('never offers EURC for the card', () => {
    expect(
      getRhinoChainsForDestination(ASSETS, { destinationType: 'RAIN_CARD', symbol: 'EURC' }),
    ).toEqual([]);
  });

  it('keeps savings to routes into the vault being funded', () => {
    const soUsd = { destinationType: 'PROTOCOL' as const, vault: 'soUSD' };
    expect(chainsOf(getRhinoChainsForDestination(ASSETS, { ...soUsd, symbol: 'USDC' }))).toEqual([
      'OPTIMISM',
    ]);
    // ETH funds soETH, so the soUSD screen does not offer it.
    expect(getRhinoChainsForDestination(ASSETS, { ...soUsd, symbol: 'ETH' })).toEqual([]);
    expect(
      chainsOf(
        getRhinoChainsForDestination(ASSETS, {
          destinationType: 'PROTOCOL',
          symbol: 'ETH',
          vault: 'soETH',
        }),
      ),
    ).toEqual(['OPTIMISM']);
  });

  it('offers nothing when rhino.fi is off or has not answered', () => {
    expect(
      getRhinoChainsForDestination(
        { enabled: false, chains: ASSETS.chains },
        {
          destinationType: 'WALLET',
        },
      ),
    ).toEqual([]);
    expect(getRhinoChainsForDestination(undefined, { destinationType: 'WALLET' })).toEqual([]);
  });

  it('leaves out a chain whose address format the app cannot check', () => {
    const withBitcoin = {
      enabled: true,
      chains: [
        ...ASSETS.chains,
        {
          chain: 'BITCOIN',
          name: 'Bitcoin',
          addressType: 'BTC' as never,
          tokens: [{ symbol: 'USDC', address: 'x', routes: [route('WALLET', 'USDC')] }],
        },
      ],
    };
    expect(
      chainsOf(getRhinoChainsForDestination(withBitcoin, { destinationType: 'WALLET' })),
    ).not.toContain('BITCOIN');
  });
});

describe('resolveRhinoTokenSymbol', () => {
  const optimism = ASSETS.chains[1];

  it('skips the token choice when one token qualifies', () => {
    expect(resolveRhinoTokenSymbol(ASSETS.chains[0], { destinationType: 'RAIN_CARD' })).toBe(
      'USDT',
    );
    expect(resolveRhinoTokenSymbol(optimism, { destinationType: 'WALLET', symbol: 'ETH' })).toBe(
      'ETH',
    );
  });

  it('asks when more than one does', () => {
    // USDC and ETH both reach the card from Optimism; EURC does not.
    expect(resolveRhinoTokenSymbol(optimism, { destinationType: 'RAIN_CARD' })).toBeUndefined();
  });
});

describe('findRhinoRoute', () => {
  it('resolves a selection to the route it pays out on', () => {
    const found = findRhinoRoute(ASSETS, {
      chain: 'OPTIMISM',
      tokenSymbol: 'ETH',
      destinationType: 'PROTOCOL',
      vault: 'soETH',
    });
    expect(found?.chain.name).toBe('Optimism');
    expect(found?.route).toMatchObject({ receiveSymbol: 'ETH', receiveChainId: mainnet.id });
  });

  it('finds nothing for a pairing that is not offered', () => {
    expect(
      findRhinoRoute(ASSETS, {
        chain: 'SOLANA',
        tokenSymbol: 'USDC',
        destinationType: 'RAIN_CARD',
      }),
    ).toBeUndefined();
    expect(
      findRhinoRoute(
        { ...ASSETS, enabled: false },
        {
          chain: 'TRON',
          tokenSymbol: 'USDT',
          destinationType: 'WALLET',
        },
      ),
    ).toBeUndefined();
  });
});

describe('isValidRhinoDepositAddress', () => {
  it('accepts each chain’s own format', () => {
    expect(isValidRhinoDepositAddress(EVM_ADDRESS, 'EVM')).toBe(true);
    expect(isValidRhinoDepositAddress(EVM_ADDRESS.toLowerCase(), 'EVM')).toBe(true);
    expect(isValidRhinoDepositAddress(TRON_ADDRESS, 'TRON')).toBe(true);
    expect(isValidRhinoDepositAddress(SOLANA_ADDRESS, 'SOL')).toBe(true);
  });

  // A 0x address for Tron (or the reverse) is one nothing on that chain can send to.
  it('rejects an address in another chain’s format', () => {
    expect(isValidRhinoDepositAddress(EVM_ADDRESS, 'TRON')).toBe(false);
    expect(isValidRhinoDepositAddress(EVM_ADDRESS, 'SOL')).toBe(false);
    expect(isValidRhinoDepositAddress(TRON_ADDRESS, 'EVM')).toBe(false);
    expect(isValidRhinoDepositAddress(SOLANA_ADDRESS, 'TRON')).toBe(false);
  });

  it('rejects malformed and unknown addresses', () => {
    expect(isValidRhinoDepositAddress('', 'SOL')).toBe(false);
    // 0, O, I and l are not base58.
    expect(isValidRhinoDepositAddress('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLS0', 'TRON')).toBe(false);
    expect(isValidRhinoDepositAddress(`${SOLANA_ADDRESS} `, 'SOL')).toBe(false);
    expect(isValidRhinoDepositAddress(EVM_ADDRESS.slice(0, 40), 'EVM')).toBe(false);
    expect(isValidRhinoDepositAddress(SOLANA_ADDRESS, 'BTC')).toBe(false);
  });
});

describe('formatDepositAddress', () => {
  it('shortens every format from both ends, keeping its own prefix', () => {
    expect(formatDepositAddress(EVM_ADDRESS)).toBe('0x8ba1f...DBA72');
    expect(formatDepositAddress(TRON_ADDRESS)).toBe('TQn9Y2k...cbLSE');
    expect(formatDepositAddress(SOLANA_ADDRESS)).toBe('7xKXtg2...sgAsU');
  });

  it('shows an address too short to shorten whole', () => {
    expect(formatDepositAddress('T1234567890abc')).toBe('T1234567890abc');
  });
});

describe('isSameDepositAddress', () => {
  it('ignores case only for EVM addresses', () => {
    expect(isSameDepositAddress(EVM_ADDRESS, EVM_ADDRESS.toLowerCase(), 'EVM')).toBe(true);
    expect(isSameDepositAddress(SOLANA_ADDRESS, SOLANA_ADDRESS.toLowerCase(), 'SOL')).toBe(false);
    expect(isSameDepositAddress(TRON_ADDRESS, TRON_ADDRESS, 'TRON')).toBe(true);
  });
});

const deposit = (overrides: Partial<RhinoDeposit>): RhinoDeposit => ({
  id: 'd1',
  chain: 'TRON',
  depositAddress: TRON_ADDRESS,
  txHash: '0xabc',
  tokenSymbol: 'USDT',
  amount: '25',
  status: 'DETECTED',
  destinationType: 'PROTOCOL',
  receiveSymbol: 'USDC',
  receiveChainId: base.id,
  createdAt: '2026-11-02T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  ...overrides,
});

describe('pickRhinoDeposit', () => {
  const match = { depositAddress: TRON_ADDRESS, chain: 'TRON', addressType: 'TRON' };

  it('picks the newest deposit to this address on this chain', () => {
    const picked = pickRhinoDeposit(
      [
        deposit({ id: 'old', createdAt: '2026-11-02T09:00:00.000Z' }),
        deposit({ id: 'new', createdAt: '2026-11-02T11:00:00.000Z' }),
        deposit({ id: 'other-chain', chain: 'SOLANA', createdAt: '2026-11-02T12:00:00.000Z' }),
        deposit({
          id: 'other-address',
          depositAddress: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
          createdAt: '2026-11-02T12:00:00.000Z',
        }),
      ],
      match,
    );
    expect(picked?.id).toBe('new');
  });

  it('matches an EVM address whatever its case', () => {
    expect(
      pickRhinoDeposit(
        [deposit({ chain: 'OPTIMISM', depositAddress: EVM_ADDRESS.toLowerCase() })],
        {
          depositAddress: EVM_ADDRESS,
          chain: 'OPTIMISM',
          addressType: 'EVM',
        },
      )?.id,
    ).toBe('d1');
  });

  it('finds nothing before a deposit arrives', () => {
    expect(pickRhinoDeposit(undefined, match)).toBeUndefined();
    expect(pickRhinoDeposit([], match)).toBeUndefined();
  });
});

describe('getRhinoRejectMessage', () => {
  it('spells out the reasons a sender can act on', () => {
    expect(getRhinoRejectMessage('UNDER_MIN')).toMatch(/below the minimum/);
    expect(getRhinoRejectMessage('OVER_MAX')).toMatch(/above the maximum/);
    expect(getRhinoRejectMessage('UNSUPPORTED_TOKEN')).toMatch(/token isn’t accepted/);
  });

  it('falls back to contacting support for every other reason', () => {
    const generic = 'rhino.fi couldn’t process this deposit, contact support.';
    [
      'OPERATION_UNAVAILABLE',
      'TERMINAL_PROCESSING_ISSUE',
      'NO_ROUTE_FOUND',
      'SDA_PAUSED',
      'SETTLEMENT_REJECTED',
      'SOMETHING_NEW',
      undefined,
    ].forEach(reason => expect(getRhinoRejectMessage(reason)).toBe(generic));
  });
});

describe('getRhinoDepositStatusView', () => {
  it('says a seen deposit is on its way', () => {
    ['DETECTED', 'ACCEPTED', 'DELAYED', 'EXECUTED'].forEach(status => {
      expect(
        getRhinoDepositStatusView(deposit({ status: status as RhinoDeposit['status'] }), 'Tron')
          .title,
      ).toBe('Received on Tron — on its way');
    });
  });

  it('explains a rejection, and a refund as returned to the sender', () => {
    expect(
      getRhinoDepositStatusView(deposit({ status: 'REJECTED', rejectReason: 'UNDER_MIN' }), 'Tron'),
    ).toMatchObject({ tone: 'error', body: getRhinoRejectMessage('UNDER_MIN') });
    expect(getRhinoDepositStatusView(deposit({ status: 'REFUNDED' }), 'Tron')).toMatchObject({
      tone: 'neutral',
      title: 'Returned to the sender',
    });
  });
});

describe('describeRhinoArrival', () => {
  it('says what lands at each destination', () => {
    expect(
      describeRhinoArrival({
        tokenSymbol: 'USDT',
        receiveSymbol: 'USDC',
        destinationType: 'PROTOCOL',
        vault: 'soUSD',
      }),
    ).toBe('Converted to USDC in your savings (soUSD)');
    expect(
      describeRhinoArrival({
        tokenSymbol: 'USDC',
        receiveSymbol: 'USDC',
        destinationType: 'PROTOCOL',
        vault: 'soUSD',
      }),
    ).toBe('Arrives as USDC in your savings (soUSD)');
    expect(
      describeRhinoArrival({
        tokenSymbol: 'ETH',
        receiveSymbol: 'USDC',
        destinationType: 'RAIN_CARD',
      }),
    ).toBe('Converted to USDC for your card');
    expect(
      describeRhinoArrival({
        tokenSymbol: 'USDT',
        receiveSymbol: 'USDT',
        receiveChainId: base.id,
        destinationType: 'WALLET',
      }),
    ).toBe('Arrives as USDT in your wallet on Base');
  });
});

describe('formatRhinoUsdLimits', () => {
  it('prints the band in dollars, leaving out a missing bound', () => {
    expect(formatRhinoUsdLimits(5, 100000)).toBe('Min $5 · Max $100,000');
    expect(formatRhinoUsdLimits(2.5, undefined)).toBe('Min $2.50');
    expect(formatRhinoUsdLimits(0, 0)).toBe('');
  });
});

describe('getRhinoAddressErrorBody', () => {
  it('explains the statuses the address endpoint uses', () => {
    expect(getRhinoAddressErrorBody({ status: 400 })).toMatch(/can’t be sent on this network/);
    expect(getRhinoAddressErrorBody({ status: 412 })).toMatch(/setting up your wallet/);
    expect(getRhinoAddressErrorBody({ status: 503 })).toMatch(/isn’t available right now/);
    expect(getRhinoAddressErrorBody({ status: 500 })).toBeUndefined();
    expect(getRhinoAddressErrorBody(new Error('boom'))).toBeUndefined();
  });
});
