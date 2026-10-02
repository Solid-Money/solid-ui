import { getMerchantCategory } from '@/lib/utils/merchantCategory';

describe('getMerchantCategory', () => {
  it('labels software stores (5734) as Software, not Home & Furniture', () => {
    expect(getMerchantCategory('5734')).toBe('Software');
  });

  it('labels electronics and music stores in the 5700s', () => {
    expect(getMerchantCategory('5732')).toBe('Electronics');
    expect(getMerchantCategory('5733')).toBe('Music');
    expect(getMerchantCategory('5735')).toBe('Music');
  });

  it('keeps Home & Furniture for actual furnishing codes', () => {
    expect(getMerchantCategory('5712')).toBe('Home & Furniture');
    expect(getMerchantCategory('5719')).toBe('Home & Furniture');
  });

  it('labels digital goods inside the 5800s as Digital Services', () => {
    expect(getMerchantCategory('5817')).toBe('Digital Services');
    expect(getMerchantCategory('5812')).toBe('Restaurant');
  });

  it('returns undefined for missing or non-numeric codes', () => {
    expect(getMerchantCategory(undefined)).toBeUndefined();
    expect(getMerchantCategory('')).toBeUndefined();
    expect(getMerchantCategory('abcd')).toBeUndefined();
  });
});
