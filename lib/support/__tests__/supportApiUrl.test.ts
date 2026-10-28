import {
  PROD_SUPPORT_API_URL,
  QA_SUPPORT_API_URL,
  supportApiUrlFor,
} from '@/lib/support/supportApiUrl';

describe('supportApiUrlFor', () => {
  it('points qa builds at the qa support service', () => {
    expect(supportApiUrlFor('https://accounts-qa.solid.xyz')).toBe(QA_SUPPORT_API_URL);
    expect(supportApiUrlFor('https://accounts-qa.solid.xyz/')).toBe(QA_SUPPORT_API_URL);
  });

  it('points production builds at the production support service', () => {
    expect(supportApiUrlFor('https://accounts.solid.xyz')).toBe(PROD_SUPPORT_API_URL);
    expect(supportApiUrlFor('https://accounts.solid.xyz/')).toBe(PROD_SUPPORT_API_URL);
  });

  it('leaves every other build without a default', () => {
    expect(supportApiUrlFor('http://localhost:5001')).toBe('');
    expect(supportApiUrlFor('https://accounts.solid.xyz.evil.com')).toBe('');
    expect(supportApiUrlFor('')).toBe('');
  });
});
