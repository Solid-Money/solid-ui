import { useNewSwapFlow } from '@/hooks/swap/useNewSwapFlow';

let mockDevBuild = false;
let mockWhitelisted = false;

jest.mock('@/lib/config', () => ({
  get isDevFeatureEnabled() {
    return mockDevBuild;
  },
}));
jest.mock('@/hooks/useFeatureAccess', () => ({
  useHasFeature: (feature: string) => feature === 'swap' && mockWhitelisted,
}));

describe('useNewSwapFlow', () => {
  beforeEach(() => {
    mockDevBuild = false;
    mockWhitelisted = false;
  });

  it('gives a production user the current form', () => {
    expect(useNewSwapFlow()).toBe(false);
  });

  it('gives a whitelisted production user the new one', () => {
    mockWhitelisted = true;
    expect(useNewSwapFlow()).toBe(true);
  });

  it('gives everyone on qa and preview builds the new one', () => {
    mockDevBuild = true;
    expect(useNewSwapFlow()).toBe(true);
  });
});
