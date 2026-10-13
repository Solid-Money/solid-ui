import getTokenIcon from '@/lib/getTokenIcon';

jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => ({ asset: path }) }));
jest.mock('@/components/DefaultTokenIcon', () => 'DefaultTokenIcon');
jest.mock('@/constants/gooddollar', () => ({ G_DOLLAR_LOGO_URI: 'g-dollar' }));

describe('getTokenIcon', () => {
  it('draws soUSD with its own mark, unclipped, whatever logo the token carries', () => {
    expect(getTokenIcon({ tokenSymbol: 'soUSD', logoUrl: 'https://old/logo.png' })).toEqual({
      type: 'image',
      source: { asset: 'images/sousd-4x.png' },
      bare: true,
    });
    expect(getTokenIcon({ tokenSymbol: 'SoUSD' }).bare).toBe(true);
  });

  it('keeps other coins as round logos', () => {
    expect(getTokenIcon({ tokenSymbol: 'USDC' }).bare).toBeUndefined();
    expect(getTokenIcon({ tokenSymbol: 'soETH' }).bare).toBeUndefined();
  });
});
