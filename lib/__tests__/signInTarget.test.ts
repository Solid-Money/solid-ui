import { signInTarget } from '@/lib/signInTarget';

describe('signInTarget', () => {
  it('keeps an in-app path and its query', () => {
    expect(signInTarget('/support')).toBe('/support');
    expect(signInTarget('/rewards', '?ref=abc')).toBe('/rewards?ref=abc');
    expect(signInTarget('/rewards', 'ref=abc')).toBe('/rewards?ref=abc');
  });

  it('ignores Home, empty paths and other sites', () => {
    expect(signInTarget('/')).toBeNull();
    expect(signInTarget('')).toBeNull();
    expect(signInTarget(undefined)).toBeNull();
    expect(signInTarget('//evil.example/support')).toBeNull();
    expect(signInTarget('https://evil.example/support')).toBeNull();
  });
});
