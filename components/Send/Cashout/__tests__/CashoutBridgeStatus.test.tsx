import React from 'react';

import { CashoutBridgeStatus } from '@/components/Send/Cashout/CashoutBridgeStatus';
import { TRACKING_EVENTS } from '@/constants/tracking-events';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('lucide-react-native', () => ({ Check: 'Check', Info: 'Info', XCircle: 'XCircle' }));
jest.mock('@/components/DepositStepper', () => ({ __esModule: true, default: 'DepositStepper' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mockState.send }) }));
jest.mock('@/hooks/useCashout', () => ({
  useCashoutUsdc: () => ({ balanceWei: 0n, decimals: 6, isLoading: false }),
}));
jest.mock('@/hooks/useTransfiCashout', () => ({
  useTransfiCashoutConfig: () => ({ data: { tokenNetwork: 'Base', chainId: 8453 } }),
}));
jest.mock('@/hooks/useWalletTokens', () => ({ useWalletTokens: () => ({ refresh: jest.fn() }) }));
jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));
jest.mock('@/lib/api/cross-chain-send', () => ({ fetchCrossChainSend: jest.fn() }));
// The real sanitizer, without the rest of lib/errors.
jest.mock('@/lib/errors', () => ({
  sanitizeTechnicalMessage: jest.requireActual('@/lib/errors/sanitize').sanitizeTechnicalMessage,
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/lib/utils/cross-chain-send', () => ({
  formatLD: (amountLD: string) => jest.requireActual('viem').formatUnits(BigInt(amountLD), 6),
}));
jest.mock('@/store/useSendStore', () => ({
  useSendStore: (selector: (state: any) => unknown) => selector({ setModal: jest.fn() }),
}));
jest.mock('@/store/useCashoutStore', () => ({
  useCashoutStore: (selector: (state: any) => unknown) =>
    selector({
      bridge: { sendId: 'send-1', shortfallLD: '187600000', delivered: false },
      usdcAmount: '200',
      settleBridge: jest.fn(),
      reset: jest.fn(),
    }),
}));

const mockTrack = jest.fn();
const mockState: { send?: Record<string, unknown> } = {};

// Fakes. Each is joined at runtime so the file holds nothing in a real key's
// format, which secret scanning would block on push.
const SECRETS = {
  apiKey: ['pim', 'FAKEKEY0000TEST'].join('_'),
  bearer: ['fake', 'bearer', 'token', '0000'].join('.'),
  liveKey: ['sk', 'live', 'FAKEKEY0000TEST'].join('_'),
};

const failedSend = (failureReason?: string) => ({
  sendId: 'send-1',
  status: 'failed',
  amountReceivedLD: '0',
  etaMinutes: 2,
  failureReason,
});

const render = () => {
  act(() => {
    create(<CashoutBridgeStatus />);
  });
};

/** The payload of the one CASH_OUT_BRIDGE_FAILED event. */
const failedEvent = () => {
  const calls = mockTrack.mock.calls.filter(
    ([event]) => event === TRACKING_EVENTS.CASH_OUT_BRIDGE_FAILED,
  );
  expect(calls).toHaveLength(1);
  return calls[0][1] as Record<string, unknown>;
};

beforeEach(() => {
  mockTrack.mockClear();
  mockState.send = undefined;
});

describe('CashoutBridgeStatus', () => {
  it('sends analytics only a sanitized failure reason', () => {
    mockState.send = failedSend(
      'Bundler rejected the user operation: POST ' +
        `https://bundler.example.com/rpc/v2?apikey=${SECRETS.apiKey} ` +
        `Authorization: Bearer ${SECRETS.bearer} (key ${SECRETS.liveKey})`,
    );
    render();

    const payload = failedEvent();
    const message = String(payload.error_message);
    expect(payload).toMatchObject({ send_id: 'send-1', status: 'failed' });
    for (const secret of Object.values(SECRETS)) {
      expect(JSON.stringify(payload)).not.toContain(secret);
    }
    expect(message).not.toContain('/rpc/v2');
    expect(message).toContain('Bundler rejected the user operation');
    expect(message).toContain('[redacted]');
  });

  it('sends an empty reason when the backend gave none', () => {
    mockState.send = failedSend(undefined);
    render();
    expect(failedEvent().error_message).toBe('');
  });

  it('sends no failure while the move is still on its way', () => {
    mockState.send = { ...failedSend(undefined), status: 'sent' };
    render();
    expect(mockTrack).not.toHaveBeenCalledWith(
      TRACKING_EVENTS.CASH_OUT_BRIDGE_FAILED,
      expect.anything(),
    );
  });
});
