/// <reference types="jest" />
import { trimToDecimals } from '../utils';

describe('trimToDecimals', () => {
  it('truncates to the specified number of decimal places', () => {
    expect(trimToDecimals('1.123456789012345678', 8)).toBe('1.12345678');
  });

  it('returns the value unchanged if fewer decimals than max', () => {
    expect(trimToDecimals('1.1234', 8)).toBe('1.1234');
  });

  it('returns the value unchanged if no decimal point', () => {
    expect(trimToDecimals('100', 8)).toBe('100');
  });

  it('handles zero decimals', () => {
    expect(trimToDecimals('1.999', 0)).toBe('1.');
  });

  it('handles exact number of decimals', () => {
    expect(trimToDecimals('1.12345678', 8)).toBe('1.12345678');
  });

  it('does not round up', () => {
    expect(trimToDecimals('1.999999999', 8)).toBe('1.99999999');
  });

  it('handles very small numbers', () => {
    expect(trimToDecimals('0.000000001234567890', 8)).toBe('0.00000000');
  });

  it('handles empty decimal part', () => {
    expect(trimToDecimals('1.', 8)).toBe('1.');
  });
});
