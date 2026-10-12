import { QA_SUPPORT_API_URL, supportApiUrlFor } from '@/lib/support/supportApiUrl';

describe('supportApiUrlFor', () => {
  it('points qa builds at the qa support service', () => {
    expect(supportApiUrlFor('https://accounts-qa.solid.xyz')).toBe(QA_SUPPORT_API_URL);
    expect(supportApiUrlFor('https://accounts-qa.solid.xyz/')).toBe(QA_SUPPORT_API_URL);
  });

  it('leaves every other build without a default', () => {
    expect(supportApiUrlFor('https://accounts.solid.xyz')).toBe('');
    expect(supportApiUrlFor('http://localhost:5001')).toBe('');
    expect(supportApiUrlFor('')).toBe('');
  });
});
