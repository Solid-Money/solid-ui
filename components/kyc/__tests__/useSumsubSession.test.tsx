import React, { useEffect } from 'react';

import { useSumsubSession } from '@/components/kyc/useSumsubSession';
import { createSumsubSession } from '@/lib/api';

import type { SumsubSessionState } from '@/components/kyc/useSumsubSession';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
const mockRouter = { replace: jest.fn(), canGoBack: jest.fn(), back: jest.fn() };
const mockQueryClient = { invalidateQueries: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
}));
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => mockQueryClient,
}));
jest.mock('@/hooks/useCardStatus', () => ({ CARD_STATUS_QUERY_KEY: 'cardStatus' }));
jest.mock('@/hooks/useTransfi', () => ({ TRANSFI_STATUS_KEY: 'transfiStatus' }));
jest.mock('@/hooks/useWirexBankAccounts', () => ({ WIREX_BANK_OVERVIEW_KEY: 'wirexBankOverview' }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/api', () => ({
  createSumsubSession: jest.fn(),
  getSumsubVerificationStatus: jest.fn(),
}));
jest.mock('@/lib/errors', () => ({
  isSafeServerMessage: jest.requireActual('@/lib/errors/classify').isSafeServerMessage,
  getUserErrorMessage: jest.fn(),
  showErrorToast: jest.fn(),
}));
jest.mock('@/lib/transfiKycFlow', () => ({
  isTransfiKycFlow: () => false,
  resumeTransfiKycFlow: jest.fn(),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (run: () => unknown) => run() }));
jest.mock('@/store/useKycStore', () => ({
  useKycStore: (select: (state: { kycFlow: string }) => unknown) => select({ kycFlow: 'card' }),
}));
jest.mock('@/store/useCountryStore', () => ({
  useCountryStore: { getState: () => ({ countryInfo: null }) },
}));
jest.mock('@/store/useDepositStore', () => ({
  useDepositStore: { getState: () => ({ setModal: jest.fn() }) },
}));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: { getState: () => ({ users: [{ selected: true, userId: 'test-user' }] }) },
}));

const fallback = 'Identity verification is temporarily unavailable. Please try again shortly.';

it.each([
  ['Please try again in a few minutes.', 'Please try again in a few minutes.'],
  ['Sumsub request failed at https://provider.test/private', fallback],
  ['{"statusCode":503,"token":"private"}', fallback],
  ['TypeError: cannot read verification session', fallback],
  [undefined, fallback],
  [503, fallback],
  [{ detail: 'private' }, fallback],
])('shows safe unavailable copy for %p', async (message, expected) => {
  jest.mocked(createSumsubSession).mockRejectedValueOnce({ status: 503, message });
  const seen: SumsubSessionState[] = [];
  const Probe = () => {
    const { session } = useSumsubSession();
    useEffect(() => {
      seen.push(session);
    }, [session]);
    return null;
  };
  let tree: any;
  await act(async () => {
    tree = create(<Probe />);
  });
  expect(seen[seen.length - 1]).toEqual({ phase: 'unavailable', message: expected });
  act(() => tree.unmount());
});
