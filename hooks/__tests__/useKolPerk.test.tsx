import React from 'react';

import { useKolPerk } from '@/hooks/useProductFees';

const { act, create } = jest.requireActual('react-test-renderer');
let mockQuery: { data: unknown; isError: boolean };
let perk: ReturnType<typeof useKolPerk>;
let root: any;
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => mockQuery,
  useMutation: jest.fn(),
}));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: (selector: any) => selector({ users: [{ selected: true, userId: 'account-a' }] }),
}));
jest.mock('@/lib/api', () => ({
  fetchFeePromotions: jest.fn(),
  fetchKolPerk: jest.fn(),
  fetchProductFeeRates: jest.fn(),
  recordSwapFee: jest.fn(),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: jest.fn() }));

const ACTIVE = {
  kolUsername: 'artem.betev',
  grantedAt: '2026-11-23T12:00:00.000Z',
  tierDiscount: null,
  sepa: {
    freeUntil: '2026-12-23T12:00:00.000Z',
    capUsd: 10000,
    coveredUsd: 0,
    remainingUsd: 10000,
    waivedFeeUsd: 0,
    active: true,
  },
};

function Probe() {
  const value = useKolPerk();
  React.useEffect(() => {
    perk = value;
  }, [value]);
  return null;
}
const render = () => act(() => root.update(<Probe />));

beforeEach(() => {
  mockQuery = { data: ACTIVE, isError: false };
  act(() => {
    root = create(<Probe />);
  });
});
afterEach(() => {
  act(() => root.unmount());
});

it('shows the perk it read', () => {
  expect(perk).toBe(ACTIVE);
});

it('hides the perk once a refresh fails, though the last read is still cached', () => {
  // TanStack Query keeps `data` from the last success when a refetch fails.
  mockQuery = { data: ACTIVE, isError: true };
  render();
  expect(perk).toBeNull();

  // A later refresh that succeeds shows it again.
  mockQuery = { data: ACTIVE, isError: false };
  render();
  expect(perk).toBe(ACTIVE);
});

it('shows nothing before the first read', () => {
  mockQuery = { data: undefined, isError: false };
  render();
  expect(perk).toBeNull();
});
