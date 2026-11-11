import { homeLinkParamsFor, parseHomeLinkAction } from '@/constants/homeLinkParams';

const ID = '000000000000000000000001';

const parse = (query: string) => {
  const params = new URLSearchParams(query);
  return parseHomeLinkAction(param => params.get(param));
};

describe('parseHomeLinkAction', () => {
  it('opens a What’s New announcement on the page the link names', () => {
    expect(parse(`whatsNew=${ID}&whatsNewStep=2`)).toEqual({
      kind: 'whats-new',
      id: ID,
      step: 2,
    });
  });

  it('opens it on its first page when no page, or no readable page, is named', () => {
    expect(parse(`whatsNew=${ID}`)).toEqual({ kind: 'whats-new', id: ID, step: 0 });
    expect(parse(`whatsNew=${ID}&whatsNewStep=-1`)).toEqual({ kind: 'whats-new', id: ID, step: 0 });
    expect(parse(`whatsNew=${ID}&whatsNewStep=two`)).toEqual({
      kind: 'whats-new',
      id: ID,
      step: 0,
    });
  });

  it('bounds a hand-edited page number', () => {
    expect(parse(`whatsNew=${ID}&whatsNewStep=99`)).toEqual({
      kind: 'whats-new',
      id: ID,
      step: 49,
    });
    expect(parse(`whatsNew=${ID}&whatsNewStep=100`)).toEqual({
      kind: 'whats-new',
      id: ID,
      step: 0,
    });
  });

  it('ignores an announcement id that is not an id', () => {
    expect(parse('whatsNew=latest&whatsNewStep=1')).toBeUndefined();
  });

  it.each([
    ['open', 'open'],
    ['cash', 'cash'],
  ])('opens the deposit sheet on %s', (value, target) => {
    expect(parse(`deposit=${value}`)).toEqual({ kind: 'deposit', target });
  });

  it('ignores a deposit target it does not know', () => {
    expect(parse('deposit=crypto')).toBeUndefined();
  });

  it('opens the spend-mode selector only for spendMode=open', () => {
    expect(parse('spendMode=open')).toEqual({ kind: 'spend-mode' });
    expect(parse('spendMode=credit')).toBeUndefined();
  });

  it('acts on one thing when a link names several', () => {
    expect(parse(`deposit=cash&spendMode=open&whatsNew=${ID}`)).toEqual({
      kind: 'whats-new',
      id: ID,
      step: 0,
    });
    expect(parse('spendMode=open&deposit=cash')).toEqual({ kind: 'deposit', target: 'cash' });
  });

  it('ignores the campaign query and a plain Home link', () => {
    expect(parse('utm_source=x&utm_medium=push')).toBeUndefined();
    expect(parse('')).toBeUndefined();
  });

  it('honours only a single value of a param the router repeats', () => {
    expect(parseHomeLinkAction(param => (param === 'deposit' ? ['cash', 'open'] : undefined))).toBe(
      undefined,
    );
  });
});

describe('homeLinkParamsFor', () => {
  it.each([
    [{ kind: 'whats-new', id: ID, step: 3 } as const, { whatsNew: ID, whatsNewStep: '3' }],
    [{ kind: 'deposit', target: 'cash' } as const, { deposit: 'cash' }],
    [{ kind: 'spend-mode' } as const, { spendMode: 'open' }],
  ])('round-trips %o', (action, params) => {
    expect(homeLinkParamsFor(action)).toEqual(params);
    expect(parseHomeLinkAction(param => params[param as keyof typeof params])).toEqual(action);
  });
});
