import { searchFromParams, signInTarget } from '@/lib/signInTarget';

describe('signInTarget', () => {
  it('keeps an in-app path and its query', () => {
    expect(signInTarget('/support')).toBe('/support');
    expect(signInTarget('/rewards', '?ref=abc')).toBe('/rewards?ref=abc');
    expect(signInTarget('/rewards', 'ref=abc')).toBe('/rewards?ref=abc');
  });

  it('keeps Home only when a query opens a view', () => {
    expect(signInTarget('/')).toBeNull();
    expect(signInTarget('/', '?')).toBeNull();
    expect(signInTarget('/', '?screen=card-info')).toBe('/?screen=card-info');
  });

  it('ignores empty paths and other sites', () => {
    expect(signInTarget('')).toBeNull();
    expect(signInTarget(undefined)).toBeNull();
    expect(signInTarget('//evil.example/support')).toBeNull();
    expect(signInTarget('https://evil.example/support')).toBeNull();
  });
});

describe('searchFromParams', () => {
  it('builds the query from route params on native', () => {
    expect(searchFromParams({ vault: 'fuse' }, ['(protected)', '(tabs)', 'savings'])).toBe(
      '?vault=fuse',
    );
    expect(searchFromParams({ tag: ['a', 'b'] }, ['(protected)', 'activity'])).toBe('?tag=a&tag=b');
    expect(searchFromParams({}, ['(protected)', 'support'])).toBe('');
  });

  it("leaves out the route's own dynamic segments", () => {
    expect(
      searchFromParams({ id: 'abc', tab: 'details' }, ['(protected)', 'activity', '[id]']),
    ).toBe('?tab=details');
    expect(searchFromParams({ rest: ['a', 'b'] }, ['(protected)', 'help', '[...rest]'])).toBe('');
  });
});
