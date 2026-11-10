import { arbitrum, base, bsc, fuse, mainnet, optimism, polygon } from 'viem/chains';

import {
  RHINO_ASSETS,
  RHINO_ASSETS_WITH_BASE_USDT_ROUTES,
  RHINO_ASSETS_WITH_BITCOIN,
} from '@/lib/__tests__/rhinoFixtures';
import {
  describeRhinoArrival,
  findRhinoRoute,
  findRhinoRouteForRow,
  formatDepositAddress,
  formatRhinoUsdLimits,
  getRhinoAddressErrorBody,
  getRhinoAssetsNotice,
  getRhinoAssetsState,
  getRhinoChainNote,
  getRhinoChainsForDestination,
  getRhinoDepositStatusView,
  getRhinoExtraChains,
  getRhinoExtraSelection,
  getRhinoListNotice,
  getRhinoRejectMessage,
  getRhinoSelectionForRow,
  getRhinoTokensForDestination,
  isKnownRhinoAddressType,
  isOfferedRhinoRow,
  isOwnPayoutChain,
  isOwnPipelineChain,
  isOwnPipelineToken,
  isRhinoDepositOffered,
  isSameDepositAddress,
  isValidRhinoDepositAddress,
  OWN_PIPELINE_TOKEN_CHAINS,
  pickRhinoDeposit,
  resolveRhinoRow,
  RhinoAssetsState,
  RhinoRowState,
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
      chainId: optimism.id,
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
  // No rollout gate: whoever the user is, the backend's answer decides.
  it('needs only a backend with rhino.fi on', () => {
    expect(isRhinoDepositOffered(ASSETS)).toBe(true);
    expect(isRhinoDepositOffered({ enabled: false, chains: ASSETS.chains })).toBe(false);
    expect(isRhinoDepositOffered(undefined)).toBe(false);
  });
});

describe('getRhinoAssetsState', () => {
  const idle = { isFetching: false, isError: false };

  it('is ready once the backend answers with rhino.fi on', () => {
    expect(getRhinoAssetsState(ASSETS, idle)).toEqual({ status: 'ready', assets: ASSETS });
  });

  it('keeps the rows while a refresh is out or has failed', () => {
    expect(getRhinoAssetsState(ASSETS, { isFetching: true, isError: false }).status).toBe('ready');
    expect(getRhinoAssetsState(ASSETS, { isFetching: false, isError: true }).status).toBe('ready');
  });

  it('is loading until the first answer, and while a retry is out', () => {
    expect(getRhinoAssetsState(undefined, { isFetching: true, isError: false }).status).toBe(
      'loading',
    );
    expect(getRhinoAssetsState(undefined, idle).status).toBe('loading');
    expect(getRhinoAssetsState(undefined, { isFetching: true, isError: true }).status).toBe(
      'loading',
    );
  });

  it('is unavailable when the request failed', () => {
    expect(getRhinoAssetsState(undefined, { isFetching: false, isError: true })).toEqual({
      status: 'unavailable',
    });
    expect(
      getRhinoAssetsState(undefined, {
        isFetching: false,
        isError: true,
        error: { status: 503 },
      }),
    ).toEqual({ status: 'unavailable' });
  });

  // The backend answers `enabled: false` without a rhino.fi key: asking again
  // gets the same answer, so it is not a failure to retry.
  it('is disabled when the backend has rhino.fi off, even while a refresh is out', () => {
    const OFF = { enabled: false, chains: [] };
    expect(getRhinoAssetsState(OFF, idle)).toEqual({ status: 'disabled' });
    expect(getRhinoAssetsState(OFF, { isFetching: true, isError: false }).status).toBe('disabled');
    expect(getRhinoAssetsState(OFF, { isFetching: false, isError: true }).status).toBe('disabled');
  });

  // A backend from before rhino.fi has no such endpoint.
  it('is disabled when the backend has no rhino.fi endpoint', () => {
    expect(
      getRhinoAssetsState(undefined, { isFetching: false, isError: true, error: { status: 404 } }),
    ).toEqual({ status: 'disabled' });
    // Not from an error the query has since got past.
    expect(
      getRhinoAssetsState(ASSETS, { isFetching: false, isError: false, error: { status: 404 } })
        .status,
    ).toBe('ready');
  });
});

describe('getRhinoAssetsNotice', () => {
  it('waits while the routes are out, and offers a retry when they cannot be had', () => {
    expect(getRhinoAssetsNotice('loading')).toBe('loading');
    expect(getRhinoAssetsNotice('unavailable')).toBe('unavailable');
  });

  it('says nothing once they are in, or when rhino.fi is off', () => {
    expect(getRhinoAssetsNotice('ready')).toBeUndefined();
    expect(getRhinoAssetsNotice('disabled')).toBeUndefined();
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
    const withTon = {
      enabled: true,
      chains: [
        ...ASSETS.chains,
        {
          chain: 'TON',
          name: 'TON',
          addressType: 'TON' as never,
          tokens: [{ symbol: 'USDT', address: 'x', routes: [route('WALLET', 'USDC')] }],
        },
      ],
    };
    expect(
      chainsOf(getRhinoChainsForDestination(withTon, { destinationType: 'WALLET' })),
    ).not.toContain('TON');
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
  const match = {
    depositAddress: TRON_ADDRESS,
    chain: 'TRON',
    addressType: 'TRON',
    tokenSymbol: 'USDT',
    destinationType: 'PROTOCOL' as const,
  };

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
        { ...match, depositAddress: EVM_ADDRESS, chain: 'OPTIMISM', addressType: 'EVM' },
      )?.id,
    ).toBe('d1');
  });

  // One address takes more than one token (the card's takes USDC, USDT and
  // ETH): a newer deposit of another token, or for another destination, is
  // another screen's, and must not decide what this one shows.
  it('picks only a deposit of this token, for this destination', () => {
    const picked = pickRhinoDeposit(
      [
        deposit({ id: 'mine', createdAt: '2026-11-02T10:00:00.000Z' }),
        deposit({ id: 'other-token', tokenSymbol: 'USDC', createdAt: '2026-11-02T11:00:00.000Z' }),
        deposit({
          id: 'other-destination',
          destinationType: 'WALLET',
          createdAt: '2026-11-02T12:00:00.000Z',
        }),
      ],
      match,
    );
    expect(picked?.id).toBe('mine');
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

describe('findRhinoRouteForRow', () => {
  it('matches a row to the rhino.fi chain with its chainId', () => {
    const found = findRhinoRouteForRow(RHINO_ASSETS, {
      chainId: arbitrum.id,
      destinationType: 'RAIN_CARD',
      symbol: 'USDC',
    });
    expect(found?.chain.chain).toBe('ARBITRUM');
    // Card USDC arrives as sent.
    expect(found?.route).toMatchObject({ receiveSymbol: 'USDC', receiveChainId: base.id });
    expect(
      findRhinoRouteForRow(RHINO_ASSETS, {
        chainId: polygon.id,
        destinationType: 'PROTOCOL',
        symbol: 'USDT',
        vault: 'soUSD',
      })?.chain.chain,
    ).toBe('MATIC_POS');
  });

  it('needs a route for the row’s own destination and token', () => {
    // MATIC_POS carries no ETH, and Arbitrum no EURC.
    expect(
      findRhinoRouteForRow(RHINO_ASSETS, {
        chainId: polygon.id,
        destinationType: 'WALLET',
        symbol: 'ETH',
      }),
    ).toBeUndefined();
    expect(
      findRhinoRouteForRow(RHINO_ASSETS, {
        chainId: arbitrum.id,
        destinationType: 'WALLET',
        symbol: 'EURC',
      }),
    ).toBeUndefined();
    // EURC is never converted, so it has no card route.
    expect(
      findRhinoRouteForRow(RHINO_ASSETS, {
        chainId: base.id,
        destinationType: 'RAIN_CARD',
        symbol: 'EURC',
      }),
    ).toBeUndefined();
  });

  // A Base deposit into a Base product goes through rhino.fi too.
  it('matches the chain a route pays out on like any other', () => {
    (['WALLET', 'RAIN_CARD'] as const).forEach(destinationType =>
      expect(
        findRhinoRouteForRow(RHINO_ASSETS, { chainId: base.id, destinationType, symbol: 'USDC' })
          ?.chain.chain,
      ).toBe('BASE'),
    );
    expect(
      findRhinoRouteForRow(RHINO_ASSETS, {
        chainId: base.id,
        destinationType: 'PROTOCOL',
        symbol: 'EURC',
        vault: 'soEURC',
      })?.route,
    ).toMatchObject({ receiveSymbol: 'EURC', receiveChainId: base.id });
    expect(
      findRhinoRouteForRow(RHINO_ASSETS, {
        chainId: mainnet.id,
        destinationType: 'PROTOCOL',
        symbol: 'ETH',
        vault: 'soETH',
      })?.route,
    ).toMatchObject({ receiveSymbol: 'ETH', receiveChainId: mainnet.id });
  });

  it('matches savings only into the vault the token funds', () => {
    const soEth = { destinationType: 'PROTOCOL' as const, symbol: 'ETH', vault: 'soETH' };
    expect(findRhinoRouteForRow(RHINO_ASSETS, { ...soEth, chainId: arbitrum.id })).toBeDefined();
    expect(
      findRhinoRouteForRow(RHINO_ASSETS, {
        chainId: arbitrum.id,
        destinationType: 'PROTOCOL',
        symbol: 'ETH',
        vault: 'soUSD',
      }),
    ).toBeUndefined();
  });

  // No symbol list of its own: a row asks for its screen's token, and rhino.fi's
  // routes say where it is taken.
  it('takes any token a row asks for where rhino.fi lists a route, WBTC included', () => {
    const wbtc = (chainId: number) =>
      findRhinoRouteForRow(RHINO_ASSETS, { chainId, destinationType: 'WALLET', symbol: 'WBTC' });
    [mainnet.id, base.id, bsc.id].forEach(chainId => expect(wbtc(chainId)).toBeDefined());
    [polygon.id, arbitrum.id, optimism.id].forEach(chainId =>
      expect(wbtc(chainId)).toBeUndefined(),
    );
    expect(
      findRhinoRouteForRow(RHINO_ASSETS, {
        chainId: base.id,
        destinationType: 'WALLET',
        symbol: 'WETH',
      }),
    ).toBeUndefined();
  });

  it('keeps Fuse on our own pipeline, whatever rhino.fi offers there', () => {
    (['WALLET', 'RAIN_CARD', 'PROTOCOL'] as const).forEach(destinationType =>
      expect(
        findRhinoRouteForRow(RHINO_ASSETS, {
          chainId: fuse.id,
          destinationType,
          symbol: 'USDC',
          ...(destinationType === 'PROTOCOL' ? { vault: 'soUSD' } : {}),
        }),
      ).toBeUndefined(),
    );
    expect(isOwnPipelineChain(fuse.id)).toBe(true);
    expect(isOwnPipelineChain(base.id)).toBe(false);
  });

  it('finds nothing while rhino.fi is off or has not answered', () => {
    const row = { chainId: arbitrum.id, destinationType: 'RAIN_CARD' as const, symbol: 'USDC' };
    expect(findRhinoRouteForRow({ ...RHINO_ASSETS, enabled: false }, row)).toBeUndefined();
    expect(findRhinoRouteForRow(undefined, row)).toBeUndefined();
  });
});

describe('getRhinoSelectionForRow', () => {
  it('names the row the address is for', () => {
    expect(
      getRhinoSelectionForRow(RHINO_ASSETS, {
        chainId: mainnet.id,
        destinationType: 'PROTOCOL',
        symbol: 'USDT',
        vault: 'soUSD',
      }),
    ).toEqual({
      chain: 'ETHEREUM',
      chainId: mainnet.id,
      tokenSymbol: 'USDT',
      destinationType: 'PROTOCOL',
      vault: 'soUSD',
    });
  });

  it('has none where rhino.fi has no route', () => {
    expect(
      getRhinoSelectionForRow(RHINO_ASSETS, {
        chainId: polygon.id,
        destinationType: 'PROTOCOL',
        symbol: 'ETH',
        vault: 'soETH',
      }),
    ).toBeUndefined();
  });
});

describe('resolveRhinoRow', () => {
  const READY: RhinoAssetsState = { status: 'ready', assets: RHINO_ASSETS };
  const LOADING: RhinoAssetsState = { status: 'loading' };
  const UNAVAILABLE: RhinoAssetsState = { status: 'unavailable' };
  const DISABLED: RhinoAssetsState = { status: 'disabled' };
  const row = (chainId: number) => ({
    chainId,
    destinationType: 'PROTOCOL' as const,
    symbol: 'USDC',
    vault: 'soUSD',
  });

  it('keeps Fuse our own, whatever the state of rhino.fi', () => {
    [READY, LOADING, UNAVAILABLE, DISABLED].forEach(state =>
      expect(resolveRhinoRow(state, row(fuse.id))).toEqual({ kind: 'own' }),
    );
  });

  // As before rhino.fi: the screen's own address on every row, with no retry.
  it('serves every row through our own pipeline while rhino.fi is off', () => {
    [mainnet.id, polygon.id, base.id, arbitrum.id, optimism.id, bsc.id].forEach(chainId => {
      expect(resolveRhinoRow(DISABLED, row(chainId))).toEqual({ kind: 'own' });
      expect(
        resolveRhinoRow(DISABLED, { chainId, destinationType: 'RAIN_CARD', symbol: 'USDC' }),
      ).toEqual({ kind: 'own' });
      expect(
        resolveRhinoRow(DISABLED, { chainId, destinationType: 'WALLET', symbol: 'ETH' }),
      ).toEqual({ kind: 'own' });
    });
    expect(getRhinoListNotice([resolveRhinoRow(DISABLED, row(polygon.id))])).toBeUndefined();
  });

  it('serves every other row through rhino.fi where it has a route', () => {
    expect(resolveRhinoRow(READY, row(polygon.id))).toEqual({
      kind: 'rhino',
      selection: {
        chain: 'MATIC_POS',
        chainId: polygon.id,
        tokenSymbol: 'USDC',
        destinationType: 'PROTOCOL',
        vault: 'soUSD',
      },
    });
  });

  // No fallback: such a row is not shown.
  it('offers no row rhino.fi has no route for', () => {
    expect(
      resolveRhinoRow(READY, {
        chainId: polygon.id,
        destinationType: 'PROTOCOL',
        symbol: 'ETH',
        vault: 'soETH',
      }),
    ).toEqual({ kind: 'none' });
  });

  it('decides no other row until the assets are in, nor when they cannot be had', () => {
    expect(resolveRhinoRow(LOADING, row(mainnet.id))).toEqual({ kind: 'loading' });
    expect(resolveRhinoRow(UNAVAILABLE, row(mainnet.id))).toEqual({ kind: 'unavailable' });
  });

  // USDT sent on Base to the wallet or the card is our own pipeline's, whatever
  // rhino.fi lists and whether or not it has answered: rhino.fi's docs have
  // Base USDT as delivery-only, so it is not trusted to accept it there.
  it('keeps wallet and card USDT on Base our own, whatever rhino.fi lists', () => {
    const WITH_BASE_USDT: RhinoAssetsState = {
      status: 'ready',
      assets: RHINO_ASSETS_WITH_BASE_USDT_ROUTES,
    };
    (['WALLET', 'RAIN_CARD'] as const).forEach(destinationType =>
      [READY, WITH_BASE_USDT, LOADING, UNAVAILABLE].forEach(state =>
        expect(
          resolveRhinoRow(state, { chainId: base.id, destinationType, symbol: 'USDT' }),
        ).toEqual({ kind: 'own' }),
      ),
    );
  });

  // Everywhere else rhino.fi takes it, and pays it out as USDC.
  it('serves wallet and card USDT off Base through rhino.fi', () => {
    (['WALLET', 'RAIN_CARD'] as const).forEach(destinationType =>
      [mainnet.id, polygon.id, arbitrum.id, optimism.id, bsc.id].forEach(chainId => {
        expect(resolveRhinoRow(READY, { chainId, destinationType, symbol: 'USDT' })).toMatchObject({
          kind: 'rhino',
          selection: { chainId, tokenSymbol: 'USDT', destinationType },
        });
        expect(resolveRhinoRow(LOADING, { chainId, destinationType, symbol: 'USDT' })).toEqual({
          kind: 'loading',
        });
      }),
    );
  });

  // Savings is unchanged: rhino.fi's soUSD route takes USDT as USDC.
  it('leaves USDT into savings to rhino.fi', () => {
    expect(
      resolveRhinoRow(READY, {
        chainId: polygon.id,
        destinationType: 'PROTOCOL',
        symbol: 'USDT',
        vault: 'soUSD',
      }),
    ).toMatchObject({ kind: 'rhino', selection: { chain: 'MATIC_POS', tokenSymbol: 'USDT' } });
    expect(
      resolveRhinoRow(LOADING, {
        chainId: polygon.id,
        destinationType: 'PROTOCOL',
        symbol: 'USDT',
        vault: 'soUSD',
      }),
    ).toEqual({ kind: 'loading' });
  });

  it('leaves every other token to the wallet or the card to rhino.fi', () => {
    expect(
      resolveRhinoRow(READY, { chainId: polygon.id, destinationType: 'RAIN_CARD', symbol: 'USDC' }),
    ).toMatchObject({ kind: 'rhino' });
    expect(
      resolveRhinoRow(LOADING, { chainId: arbitrum.id, destinationType: 'WALLET', symbol: 'ETH' }),
    ).toEqual({ kind: 'loading' });
  });

  // rhino.fi pays the wallet and the card out on Base: a deposit sent there
  // would only be paid back to Base, so Base is our own, whatever rhino.fi
  // lists there and whether or not it has answered.
  it('keeps the chain the wallet and the card are paid out on our own', () => {
    (['WALLET', 'RAIN_CARD'] as const).forEach(destinationType =>
      [READY, LOADING, UNAVAILABLE].forEach(state =>
        ['USDC', 'ETH', 'EURC'].forEach(symbol =>
          expect(resolveRhinoRow(state, { chainId: base.id, destinationType, symbol })).toEqual({
            kind: 'own',
          }),
        ),
      ),
    );
    expect(isOwnPayoutChain('WALLET', base.id)).toBe(true);
    expect(isOwnPayoutChain('RAIN_CARD', base.id)).toBe(true);
    expect(isOwnPayoutChain('WALLET', mainnet.id)).toBe(false);
    // Savings is paid out on its vault's chain, which the route says.
    expect(isOwnPayoutChain('PROTOCOL', base.id)).toBe(false);
  });

  // Savings: sent on the vault's chain, as the token the vault takes, the
  // deposit is already where it is going; our own address puts it in the vault.
  it('keeps a savings row our own where the route would pay it back as sent', () => {
    expect(resolveRhinoRow(READY, row(mainnet.id))).toEqual({ kind: 'own' });
    // Elsewhere, or as another token, rhino.fi still carries it.
    expect(resolveRhinoRow(READY, row(polygon.id))).toMatchObject({ kind: 'rhino' });
    expect(
      resolveRhinoRow(READY, {
        chainId: mainnet.id,
        destinationType: 'PROTOCOL',
        symbol: 'USDT',
        vault: 'soUSD',
      }),
    ).toMatchObject({ kind: 'rhino' });
    // Which route pays where is only known once the routes are in.
    expect(resolveRhinoRow(LOADING, row(mainnet.id))).toEqual({ kind: 'loading' });
  });
});

describe('isOwnPipelineToken', () => {
  it('is USDT on Base, to the wallet or the card, and nothing else', () => {
    expect(Object.keys(OWN_PIPELINE_TOKEN_CHAINS)).toEqual(['USDT']);
    expect(isOwnPipelineToken('USDT', 'WALLET', base.id)).toBe(true);
    expect(isOwnPipelineToken('USDT', 'RAIN_CARD', base.id)).toBe(true);
    expect(isOwnPipelineToken('USDT', 'PROTOCOL', base.id)).toBe(false);
    // Off Base, rhino.fi's (Fuse is our own for another reason: isOwnPipelineChain).
    [mainnet.id, polygon.id, arbitrum.id, optimism.id, bsc.id, fuse.id].forEach(chainId => {
      expect(isOwnPipelineToken('USDT', 'WALLET', chainId)).toBe(false);
      expect(isOwnPipelineToken('USDT', 'RAIN_CARD', chainId)).toBe(false);
    });
    ['USDC', 'EURC', 'ETH', 'WBTC'].forEach(symbol => {
      expect(isOwnPipelineToken(symbol, 'WALLET', base.id)).toBe(false);
      expect(isOwnPipelineToken(symbol, 'RAIN_CARD', base.id)).toBe(false);
    });
  });
});

/** "More networks": rhino.fi's chains the app has no row for. */
describe('getRhinoExtraChains', () => {
  // Never an app chain, which shows once as its own row, nor Arc, held back.
  it('lists only the chains the app has no row for, Arc aside', () => {
    expect(
      chainsOf(getRhinoExtraChains(RHINO_ASSETS, { destinationType: 'RAIN_CARD', symbol: 'USDC' })),
    ).toEqual(['SOLANA', 'AVALANCHE']);
    expect(
      chainsOf(
        getRhinoExtraChains(RHINO_ASSETS, {
          destinationType: 'PROTOCOL',
          symbol: 'USDT',
          vault: 'soUSD',
        }),
      ),
    ).toEqual(['TRON', 'SOLANA', 'AVALANCHE']);
  });

  it('lists only what rhino.fi routes to the screen’s destination', () => {
    expect(
      chainsOf(getRhinoExtraChains(RHINO_ASSETS, { destinationType: 'WALLET', symbol: 'EURC' })),
    ).toEqual(['SOLANA']);
    expect(
      chainsOf(getRhinoExtraChains(RHINO_ASSETS, { destinationType: 'RAIN_CARD', symbol: 'EURC' })),
    ).toEqual([]);
    expect(
      getRhinoExtraChains(RHINO_ASSETS, {
        destinationType: 'PROTOCOL',
        symbol: 'ETH',
        vault: 'soUSD',
      }),
    ).toEqual([]);
  });

  // Tron, Solana and the rest pay wallet and card USDT out as USDC.
  it('lists wallet and card USDT on the chains the app has no row for', () => {
    (['WALLET', 'RAIN_CARD'] as const).forEach(destinationType =>
      expect(
        chainsOf(getRhinoExtraChains(RHINO_ASSETS, { destinationType, symbol: 'USDT' })),
      ).toEqual(['TRON', 'SOLANA', 'AVALANCHE']),
    );
  });

  it('has none while rhino.fi is off', () => {
    expect(getRhinoExtraChains(undefined, { destinationType: 'WALLET', symbol: 'USDC' })).toEqual(
      [],
    );
    expect(
      getRhinoExtraChains(
        { ...RHINO_ASSETS, enabled: false },
        { destinationType: 'WALLET', symbol: 'USDC' },
      ),
    ).toEqual([]);
  });
});

describe('getRhinoExtraSelection', () => {
  const chain = (name: string) => RHINO_ASSETS.chains.find(item => item.chain === name)!;

  it('selects the chain by rhino.fi’s id, with its EVM id only when it has one', () => {
    expect(
      getRhinoExtraSelection(chain('TRON'), {
        destinationType: 'PROTOCOL',
        symbol: 'USDT',
        vault: 'soUSD',
      }),
    ).toEqual({ chain: 'TRON', tokenSymbol: 'USDT', destinationType: 'PROTOCOL', vault: 'soUSD' });
    expect(
      getRhinoExtraSelection(chain('AVALANCHE'), { destinationType: 'WALLET', symbol: 'ETH' }),
    ).toEqual({
      chain: 'AVALANCHE',
      chainId: 43114,
      tokenSymbol: 'ETH',
      destinationType: 'WALLET',
    });
  });
});

/** A malformed `/deposit/rhino/assets` must offer nothing, never throw mid-render. */
describe('a payload with lists missing', () => {
  const broken = {
    enabled: true,
    chains: [
      { chain: 'NO_TOKENS', chainId: 1, name: 'No tokens', addressType: 'EVM', tokens: null },
      {
        chain: 'NO_ROUTES',
        chainId: 137,
        name: 'No routes',
        addressType: 'EVM',
        tokens: [{ symbol: 'USDC', address: '0x1', routes: null }],
      },
      { chain: 'NOTHING', chainId: 42161, name: 'Nothing', addressType: 'EVM' },
    ],
  } as unknown as RhinoDepositAssetsResponse;
  const noChains = { enabled: true, chains: null } as unknown as RhinoDepositAssetsResponse;
  const filter = { destinationType: 'WALLET' as const, symbol: 'USDC' };

  it('treats a missing chains list as empty', () => {
    expect(isRhinoDepositOffered(noChains)).toBe(true);
    expect(isRhinoDepositOffered(null)).toBe(false);
    expect(getRhinoChainsForDestination(noChains, filter)).toEqual([]);
    expect(
      findRhinoRoute(noChains, { chain: 'BASE', tokenSymbol: 'USDC', destinationType: 'WALLET' }),
    ).toBeUndefined();
    expect(getRhinoExtraChains(noChains, filter)).toEqual([]);
    expect(
      resolveRhinoRow({ status: 'ready', assets: noChains }, { ...filter, chainId: polygon.id }),
    ).toEqual({ kind: 'none' });
  });

  it('treats missing tokens and routes lists as empty', () => {
    broken.chains.forEach(chain => expect(getRhinoTokensForDestination(chain, filter)).toEqual([]));
    expect(getRhinoChainsForDestination(broken, filter)).toEqual([]);
    expect(
      findRhinoRoute(broken, {
        chain: 'NO_ROUTES',
        tokenSymbol: 'USDC',
        destinationType: 'WALLET',
      }),
    ).toBeUndefined();
    [mainnet.id, polygon.id, arbitrum.id].forEach(chainId =>
      expect(resolveRhinoRow({ status: 'ready', assets: broken }, { ...filter, chainId })).toEqual({
        kind: 'none',
      }),
    );
  });
});

describe('isOfferedRhinoRow', () => {
  it('offers only a row with an address, ours or rhino.fi’s', () => {
    const selection = {
      chain: 'BASE',
      chainId: base.id,
      tokenSymbol: 'USDC',
      destinationType: 'WALLET' as const,
    };
    expect(isOfferedRhinoRow({ kind: 'own' })).toBe(true);
    expect(isOfferedRhinoRow({ kind: 'rhino', selection })).toBe(true);
    expect(isOfferedRhinoRow({ kind: 'loading' })).toBe(false);
    expect(isOfferedRhinoRow({ kind: 'unavailable' })).toBe(false);
    expect(isOfferedRhinoRow({ kind: 'none' })).toBe(false);
  });
});

describe('getRhinoListNotice', () => {
  const OWN: RhinoRowState = { kind: 'own' };
  const NONE: RhinoRowState = { kind: 'none' };

  it('waits while any row does, and offers a retry when any cannot be had', () => {
    expect(getRhinoListNotice([OWN, { kind: 'loading' }])).toBe('loading');
    expect(getRhinoListNotice([OWN, { kind: 'unavailable' }])).toBe('unavailable');
    expect(getRhinoListNotice([{ kind: 'unavailable' }, { kind: 'loading' }])).toBe('loading');
  });

  it('says nothing beside rows that have an address, and says so when none does', () => {
    expect(getRhinoListNotice([OWN, NONE])).toBeUndefined();
    expect(getRhinoListNotice([NONE, NONE])).toBe('empty');
    expect(getRhinoListNotice([])).toBe('empty');
  });
});

describe('native BTC on Bitcoin', () => {
  const TAPROOT = 'bc1pwvza3f5hz85h9xdsmar8vjznsta9un82r5m5rvdsyys56u4xg75qytn3t4';
  const SEGWIT = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
  const LEGACY = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
  const P2SH = '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy';

  it('knows how to show a Bitcoin address', () => {
    expect(isKnownRhinoAddressType('BTC')).toBe(true);
    expect(isKnownRhinoAddressType('FLASH')).toBe(false);
  });

  it('takes every mainnet encoding, the Taproot rhino.fi hands out included', () => {
    for (const address of [TAPROOT, SEGWIT, LEGACY, P2SH]) {
      expect(isValidRhinoDepositAddress(address, 'BTC')).toBe(true);
    }
  });

  it('refuses a Bitcoin address that is not one, or not on mainnet', () => {
    expect(isValidRhinoDepositAddress(EVM_ADDRESS, 'BTC')).toBe(false);
    // Testnet, and characters bech32 does not have.
    expect(isValidRhinoDepositAddress('tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'BTC')).toBe(
      false,
    );
    expect(isValidRhinoDepositAddress('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlb', 'BTC')).toBe(
      false,
    );
    expect(isValidRhinoDepositAddress('bc1q', 'BTC')).toBe(false);
    // And a Bitcoin address is no address on an EVM chain.
    expect(isValidRhinoDepositAddress(TAPROOT, 'EVM')).toBe(false);
  });

  it('lists Bitcoin under "More networks" for the wallet and the card, never savings', () => {
    for (const destinationType of ['WALLET', 'RAIN_CARD'] as const) {
      expect(
        getRhinoExtraChains(RHINO_ASSETS_WITH_BITCOIN, { destinationType, symbol: 'BTC' }).map(
          chain => chain.chain,
        ),
      ).toEqual(['BITCOIN']);
    }
    expect(
      getRhinoExtraChains(RHINO_ASSETS_WITH_BITCOIN, {
        destinationType: 'PROTOCOL',
        symbol: 'BTC',
      }),
    ).toEqual([]);
    // It takes BTC alone.
    expect(
      getRhinoExtraChains(RHINO_ASSETS_WITH_BITCOIN, { destinationType: 'WALLET', symbol: 'USDC' })
        .map(chain => chain.chain)
        .includes('BITCOIN'),
    ).toBe(false);
  });

  it('says what lands: WBTC in the wallet, USDC on the card', () => {
    expect(
      describeRhinoArrival({
        tokenSymbol: 'BTC',
        receiveSymbol: 'WBTC',
        receiveChainId: base.id,
        destinationType: 'WALLET',
      }),
    ).toBe('Converted to WBTC in your wallet on Base');
    expect(
      describeRhinoArrival({
        tokenSymbol: 'BTC',
        receiveSymbol: 'USDC',
        receiveChainId: base.id,
        destinationType: 'RAIN_CARD',
      }),
    ).toBe('Converted to USDC for your card');
  });

  it('warns that Bitcoin takes longer, and nothing else does', () => {
    expect(getRhinoChainNote('BITCOIN')).toBe(
      'Arrives after 1 Bitcoin confirmation, usually 5–20 min',
    );
    expect(getRhinoChainNote('TRON')).toBeUndefined();
    expect(getRhinoChainNote(undefined)).toBeUndefined();
  });
});
