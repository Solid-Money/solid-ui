/// <reference types="jest" />

import {
  flowForAction,
  isSharedPathToast,
  markSharedPathToast,
  reportShownError,
  setShownErrorSink,
} from '@/lib/telemetry/shownErrors';

const mockReportError = jest.fn();

const shown = {
  action: 'withdraw',
  code: 'INSUFFICIENT_FUNDS',
  kind: 'insufficient_funds',
  surface: 'sheet' as const,
  title: 'Couldn’t withdraw',
  body: 'You don’t have enough to cover this.',
  technical: 'transfer amount exceeds balance',
  status: 400,
  requestId: '9c1b4f2a0e6d4b7f8a1c2d3e4f5a6b7c',
};

describe('reportShownError', () => {
  beforeEach(() => {
    mockReportError.mockReset();
    setShownErrorSink(mockReportError);
  });
  afterAll(() => setShownErrorSink(undefined));

  it('reports what the user saw, with the failed call’s request id', () => {
    reportShownError(shown);
    expect(mockReportError).toHaveBeenCalledWith({
      kind: 'flow',
      flow: 'withdraw',
      step: 'withdraw',
      code: 'INSUFFICIENT_FUNDS',
      message: 'transfer amount exceeds balance',
      userMessage: 'Couldn’t withdraw. You don’t have enough to cover this.',
      httpStatus: 400,
      refs: { requestId: shown.requestId },
    });
  });

  it('files toasts, crash screens and offline failures by kind', () => {
    reportShownError({ ...shown, surface: 'toast' });
    reportShownError({ ...shown, surface: 'screen' });
    reportShownError({ ...shown, kind: 'offline', surface: 'toast' });
    expect(mockReportError.mock.calls.map(([input]) => (input as { kind: string }).kind)).toEqual([
      'toast',
      'crash',
      'network',
    ]);
  });

  it('skips a cancelled prompt, which is a choice and not a failure', () => {
    reportShownError({ ...shown, kind: 'cancelled' });
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('goes nowhere until the root layout plugs a reporter in, and never throws', () => {
    setShownErrorSink(undefined);
    expect(() => reportShownError(shown)).not.toThrow();
    setShownErrorSink(() => {
      throw new Error('broken');
    });
    expect(() => reportShownError(shown)).not.toThrow();
  });

  it('falls back to the copy when there is no technical cause', () => {
    reportShownError({ ...shown, technical: undefined, body: undefined, requestId: undefined });
    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Couldn’t withdraw', refs: undefined }),
    );
  });
});

describe('flowForAction', () => {
  it('maps the app’s actions to the Errors page’s flows', () => {
    expect(flowForAction('move_to_card')).toBe('card_deposit');
    expect(flowForAction('sign_in')).toBe('login');
    expect(flowForAction('generic')).toBe('app');
    expect(flowForAction('something_new')).toBeUndefined();
  });
});

describe('shared-path toasts', () => {
  it('recognises only the params object that was marked', () => {
    const params = markSharedPathToast({ type: 'error', text1: 'x' });
    expect(isSharedPathToast(params)).toBe(true);
    expect(isSharedPathToast({ ...params })).toBe(false);
    expect(isSharedPathToast(undefined)).toBe(false);
  });
});
