import getTokenIcon from '@/lib/getTokenIcon';

jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => ({ asset: path }) }));
jest.mock('@/components/DefaultTokenIcon', () => 'DefaultTokenIcon');
jest.mock('@/constants/gooddollar', () => ({ G_DOLLAR_LOGO_URI: 'g-dollar' }));

describe('getTokenIcon', () => {
  it('draws each share token with its own mark, unclipped, whatever logo it carries', () => {
    expect(getTokenIcon({ tokenSymbol: 'soUSD', logoUrl: 'https://old/logo.png' })).toEqual({
      type: 'image',
      source: { asset: 'images/sousd-4x.png' },
      bare: true,
    });
    expect(getTokenIcon({ tokenSymbol: 'SoUSD' }).bare).toBe(true);
    expect(getTokenIcon({ tokenSymbol: 'soETH', logoUrl: 'https://old/eth.png' }).source).toEqual({
      asset: 'images/soeth-4x.png',
    });
    expect(getTokenIcon({ tokenSymbol: 'soFUSE' }).source).toEqual({
      asset: 'images/sofuse-4x.png',
    });
  });

  it('keeps other coins as round logos', () => {
    expect(getTokenIcon({ tokenSymbol: 'USDC' }).bare).toBeUndefined();
    expect(getTokenIcon({ tokenSymbol: 'ETH' }).bare).toBeUndefined();
    expect(getTokenIcon({ tokenSymbol: 'FUSE' }).bare).toBeUndefined();
  });
});
