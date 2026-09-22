import { formatSats, formatSmallestUnits } from '@/lib/orchestraFormat';

describe('formatSmallestUnits', () => {
  it('renders smallest units at the asset decimals', () => {
    expect(formatSmallestUnits('49750000', 6)).toBe('49.75');
    expect(formatSmallestUnits('250000', 6)).toBe('0.25');
    expect(formatSmallestUnits('50000000', 6)).toBe('50');
    expect(formatSmallestUnits('1', 6)).toBe('0');
  });

  it('pads when the asset has fewer decimals than requested places', () => {
    expect(formatSmallestUnits('4975', 2, 4)).toBe('49.75');
    expect(formatSmallestUnits('7', 0, 2)).toBe('7');
  });

  it('rounds on the first dropped digit without going through a float', () => {
    expect(formatSmallestUnits('49755000', 6)).toBe('49.76');
    expect(formatSmallestUnits('49754000', 6)).toBe('49.75');
    expect(formatSmallestUnits('999999', 6, 2)).toBe('1');
    expect(formatSmallestUnits('5000000000000000000000', 18, 2)).toBe('5,000');
  });

  it('rejects anything that is not an integer string', () => {
    expect(formatSmallestUnits('49.75', 6)).toBeUndefined();
    expect(formatSmallestUnits(undefined, 6)).toBeUndefined();
    expect(formatSmallestUnits('100', undefined)).toBeUndefined();
  });

  it('groups sats', () => {
    expect(formatSats('44210')).toBe('44,210 sats');
    expect(formatSats('abc')).toBeUndefined();
  });
});

/**
 * Hermes and the React Native Web Intl shim coerce `format`'s argument with
 * ToNumber, so handing them a BigInt throws "Cannot convert a BigInt value to a
 * number" — which is what the invoice screen did in the app. Node's Intl accepts
 * BigInt happily, so the only way to catch this in a test is to make Intl behave
 * the way the app's runtime does.
 */
describe('never hands a BigInt to Intl', () => {
  const RealNumberFormat = Intl.NumberFormat;

  beforeAll(() => {
    // Deliberately replacing the global for this suite.
    Intl.NumberFormat = function PatchedNumberFormat(
      ...args: ConstructorParameters<typeof Intl.NumberFormat>
    ) {
      const instance = new RealNumberFormat(...args);
      const realFormat = instance.format.bind(instance);
      instance.format = (value: number | bigint) => {
        if (typeof value === 'bigint') {
          throw new TypeError('Cannot convert a BigInt value to a number');
        }
        return realFormat(value);
      };
      return instance;
    } as unknown as typeof Intl.NumberFormat;
    Object.assign(Intl.NumberFormat, RealNumberFormat);
  });

  afterAll(() => {
    Intl.NumberFormat = RealNumberFormat;
  });

  it('formats smallest units on a runtime whose Intl rejects BigInt', () => {
    expect(() => formatSmallestUnits('49750000', 6)).not.toThrow();
    expect(formatSmallestUnits('49750000', 6)).toBe('49.75');
    expect(formatSmallestUnits('5000000000000000000000', 18, 2)).toBe('5,000');
  });

  it('formats sats on a runtime whose Intl rejects BigInt', () => {
    expect(() => formatSats('44210')).not.toThrow();
    expect(formatSats('44210')).toBe('44,210 sats');
  });
});
