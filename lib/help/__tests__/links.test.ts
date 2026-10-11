/// <reference types="jest" />

const mockPush = jest.fn();
const mockOpenURL = jest.fn((..._args: unknown[]) => Promise.resolve());
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('react-native', () => ({
  Linking: { openURL: (...args: unknown[]) => mockOpenURL(...args) },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const links = require('@/lib/help/links') as typeof import('@/lib/help/links');

describe('help center links', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockOpenURL.mockClear();
    links.setNativeHelpEnabled(false);
  });

  it("reads Intercom's URLs and ours", () => {
    expect(
      links.parseHelpUrl(
        'https://support.solid.xyz/en/articles/13184959-legal-privacy-policy-terms-conditions#h_5cf45398ce',
      ),
    ).toEqual({
      kind: 'article',
      slug: '13184959-legal-privacy-policy-terms-conditions',
      anchor: 'h_5cf45398ce',
    });
    expect(links.parseHelpUrl('https://support.solid.xyz/articles/card-fees-limits')).toEqual({
      kind: 'article',
      slug: 'card-fees-limits',
      anchor: null,
    });
    expect(
      links.parseHelpUrl('https://support.solid.xyz/en/collections/16780872-troubleshooting'),
    ).toEqual({
      kind: 'collection',
      slug: '16780872-troubleshooting',
    });
    expect(links.parseHelpUrl('https://support-qa.solid.xyz/collections/legal/')).toEqual({
      kind: 'collection',
      slug: 'legal',
    });
    expect(links.parseHelpUrl('https://support.solid.xyz')).toEqual({ kind: 'home' });
    expect(links.parseHelpUrl('https://support.solid.xyz/en')).toEqual({ kind: 'home' });
  });

  it('ignores other hosts and other paths', () => {
    expect(links.parseHelpUrl('https://app.solid.xyz/articles/x')).toBeNull();
    expect(links.parseHelpUrl('https://support.solid.xyz.evil.test/articles/x')).toBeNull();
    expect(links.parseHelpUrl('https://support.solid.xyz/search?q=fees')).toBeNull();
    expect(links.parseHelpUrl('mailto:support@solid.xyz')).toBeNull();
    expect(links.parseHelpUrl('https://support.solid.xyz/articles/../../etc')).toBeNull();
  });

  it('opens the website until the help center is on for this user', () => {
    links.openHelpLink('https://support.solid.xyz/en/articles/14431132-supported-networks');
    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://support.solid.xyz/en/articles/14431132-supported-networks',
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens articles, collections and the home in the app once it is on', () => {
    links.setNativeHelpEnabled(true);
    links.openHelpLink('https://support.solid.xyz/en/articles/14431132-supported-networks');
    links.openHelpLink('https://support.solid.xyz/en/collections/16780872-troubleshooting');
    links.openHelpLink('https://support.solid.xyz');
    expect(mockPush.mock.calls.map(call => call[0])).toEqual([
      '/help/articles/14431132-supported-networks',
      '/help/collections/16780872-troubleshooting',
      '/help',
    ]);
    links.openHelpLink('https://www.third-national.com/privacypolicy');
    expect(mockOpenURL).toHaveBeenCalledWith('https://www.third-national.com/privacypolicy');
  });
});
