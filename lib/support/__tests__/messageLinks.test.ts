import { canOpenSupportLink } from '@/lib/support/messageLinks';

describe('canOpenSupportLink', () => {
  it.each([
    // What Solid AI has actually linked to.
    'https://support.solid.xyz/articles/cashback-exclusions',
    'https://app.solid.xyz/recovery',
    'https://solid.xyz',
    // Markdown turns "www.solid.xyz" into this.
    'http://www.solid.xyz',
    'HTTPS://SUPPORT.SOLID.XYZ/articles/x',
  ])('opens a Solid AI link to our domain: %s', href => {
    expect(canOpenSupportLink(href, 'solid')).toBe(true);
  });

  it.each([
    'https://solid-support.help/verify',
    'https://solid.xyz.evil.example/login',
    'https://evilsolid.xyz/login',
    // The host before "@" is a username; the browser opens the one after.
    'https://solid.xyz@evil.example/',
    // A browser reads "\" as "/": this opens evil.example.
    'https://evil.example\\@solid.xyz',
    'https://solid.xyz /x',
    'mailto:help@solid.xyz',
    'tel:+15550100',
    'javascript:alert(1)',
    'ethereum:0xabc@1?value=1e18',
    'intent://scan/#Intent;scheme=zxing;end',
    '/settings',
    '',
  ])('keeps any other Solid AI link as plain text: %s', href => {
    expect(canOpenSupportLink(href, 'solid')).toBe(false);
  });

  it('opens web pages and email for teammates, never scripts, apps or wallets', () => {
    expect(canOpenSupportLink('https://www.moonpay.com/help', 'web')).toBe(true);
    expect(canOpenSupportLink('http://example.com', 'web')).toBe(true);
    expect(canOpenSupportLink('mailto:help@solid.xyz', 'web')).toBe(true);
    expect(canOpenSupportLink('javascript:alert(1)', 'web')).toBe(false);
    expect(canOpenSupportLink('data:text/html,<b>x</b>', 'web')).toBe(false);
    expect(canOpenSupportLink('ethereum:0xabc', 'web')).toBe(false);
    expect(canOpenSupportLink('solid://wallet/send', 'web')).toBe(false);
    expect(canOpenSupportLink('https://example.com/\u0000', 'web')).toBe(false);
  });
});
