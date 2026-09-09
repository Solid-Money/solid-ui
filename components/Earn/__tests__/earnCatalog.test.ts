import {
  EARN_PREVIEW_COUNT,
  formatAssetName,
  getAssetSector,
  searchTokens,
  selectCategoryTokens,
} from '@/components/Earn/earnCatalog';
import { XStockToken } from '@/hooks/useXStocksTokens';

const token = (symbol: string, name = `${symbol} name`): XStockToken => ({
  symbol,
  name,
  contractAddress: '0x0000000000000000000000000000000000000000',
  logoUrl: `https://example.test/${symbol}.png`,
});

describe('formatAssetName', () => {
  it('drops the issuer suffix from the display name', () => {
    expect(formatAssetName('TSLAx', 'Tesla xStock')).toBe('Tesla');
  });

  it('leaves a name without the suffix untouched', () => {
    expect(formatAssetName('TSLAx', 'Tesla')).toBe('Tesla');
  });

  it('keeps the original name when stripping would leave nothing', () => {
    expect(formatAssetName('WEIRDx', 'xStock')).toBe('xStock');
  });

  it('prefers the curated name over an unhelpful issuer name', () => {
    expect(formatAssetName('VTIx', 'Vanguard xStock')).toBe('Total Market ETF');
    expect(formatAssetName('SPYx', 'SP 500 xStock')).toBe('S&P 500 ETF');
    expect(formatAssetName('PALLx', 'abrdn Physical Palladium Shares xStock')).toBe('Palladium');
  });
});

describe('getAssetSector', () => {
  it('returns the curated sector caption', () => {
    expect(getAssetSector('TSLAx')).toBe('Equity · Auto');
    expect(getAssetSector('GLDx')).toBe('Metals · Gold');
  });

  it('falls back for a ticker with no caption', () => {
    expect(getAssetSector('WHOKNOWSx')).toBe('Tokenized equity');
  });
});

describe('selectCategoryTokens', () => {
  const tokens = [token('NVDAx'), token('SPYx'), token('TSLAx'), token('VTIx'), token('GLDx')];

  it('returns the curated order, not the source order', () => {
    expect(selectCategoryTokens(tokens, 'popular').map(t => t.symbol)).toEqual([
      'TSLAx',
      'SPYx',
      'NVDAx',
      'VTIx',
    ]);
  });

  it('skips curated tickers that are not in the token list', () => {
    expect(selectCategoryTokens([token('SPYx')], 'popular').map(t => t.symbol)).toEqual(['SPYx']);
  });

  it('caps the preview at the requested limit', () => {
    expect(selectCategoryTokens(tokens, 'popular', 2)).toHaveLength(2);
  });

  it('previews five rows by default', () => {
    expect(EARN_PREVIEW_COUNT).toBe(5);
  });
});

describe('searchTokens', () => {
  const tokens = [
    token('NVDAx', 'NVIDIA xStock'),
    token('TSLAx', 'Tesla xStock'),
    token('VTIx', 'Vanguard xStock'),
    token('SPYx', 'SP 500 xStock'),
  ];

  it('matches on ticker', () => {
    expect(searchTokens(tokens, 'nvda').map(t => t.symbol)).toEqual(['NVDAx']);
  });

  it('matches on display name, case-insensitively', () => {
    expect(searchTokens(tokens, 'tesla').map(t => t.symbol)).toEqual(['TSLAx']);
  });

  it('searches the curated name, not the issuer name', () => {
    // VTIx is "Vanguard xStock" upstream but shown as "Total Market ETF".
    expect(searchTokens(tokens, 'total market').map(t => t.symbol)).toEqual(['VTIx']);
  });

  it('ranks a ticker prefix above a mid-name match', () => {
    const [first] = searchTokens(
      [token('SPCXx', 'SpaceX xStock'), token('SPYx', 'SP 500 xStock')],
      'sp',
    );
    expect(first.symbol).toBe('SPCXx');
  });

  it('returns nothing for a blank query', () => {
    expect(searchTokens(tokens, '   ')).toEqual([]);
  });

  it('returns nothing when there is no match', () => {
    expect(searchTokens(tokens, 'zzzz')).toEqual([]);
  });

  it('caps results at the limit', () => {
    expect(searchTokens(tokens, 'x', 2)).toHaveLength(2);
  });
});
