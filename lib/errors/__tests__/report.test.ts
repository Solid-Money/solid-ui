/// <reference types="jest" />

import * as Sentry from '@sentry/react-native';

import { track } from '@/lib/analytics';
import { reportClientError } from '@/lib/api';
import { describeError, normalizeError, normalizeErrorAsync } from '@/lib/errors/classify';
import { compactErrorRef, formatErrorRef } from '@/lib/errors/errorRef';
import { activityFailureMetadata, reportUserError, shouldReport } from '@/lib/errors/report';
import { buildSupportContext, buildSupportMessage } from '@/lib/errors/supportMessage';
import { setShownErrorSink } from '@/lib/telemetry/shownErrors';

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/api', () => ({ reportClientError: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '2.1.0' }));
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('crypto').randomUUID() }));

const RID = '9c1b4f2a0e6d4b7f8a1c2d3e4f5a6b7c';

const report = (error: unknown, surface: 'sheet' | 'toast' = 'sheet') => {
  const normalized = normalizeError(error);
  return reportUserError(
    normalized,
    describeError(normalized, { action: 'move_to_card' }),
    surface,
    { amount: '50', token: 'USDC' },
  );
};

beforeEach(() => jest.clearAllMocks());

describe('reportUserError', () => {
  it('uses the failing request’s ID as the event ID, so the Ref matches the backend logs', () => {
    const error = Object.assign(new Error('Internal server error'), {
      status: 500,
      requestId: RID,
    });

    const result = report(error);

    expect(result).toMatchObject({ ref: '9C1B-4F2A', eventId: RID });
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      event_id: RID,
      captureContext: expect.objectContaining({
        tags: expect.objectContaining({
          error_ref: '9C1B-4F2A',
          error_code: 'HTTP_500',
          error_action: 'move_to_card',
          request_id: RID,
        }),
        fingerprint: ['user-facing-error', 'move_to_card', 'HTTP_500'],
      }),
    });
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ ref: '9C1B4F2A', eventId: RID, requestId: RID, surface: 'sheet' }),
    );
    expect(track).toHaveBeenCalledWith(
      'error_shown',
      expect.objectContaining({ error_ref: '9C1B-4F2A', event_id: RID }),
    );
  });

  it('reports the same thrown object once and hands back the same Ref', () => {
    const error = new Error('UserOperation reverted during simulation with reason: 0x');

    const first = report(error);
    const second = report(error);

    expect(second).toBe(first);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('keeps the default grouping for unknown causes', () => {
    report(new Error("Cannot read property 'name' of undefined"));

    const [, hint] = (Sentry.captureException as jest.Mock).mock.calls[0];
    expect(hint.captureContext.fingerprint).toBeUndefined();
  });

  it('wraps a raw Response, which Sentry would otherwise file as a bare object', () => {
    report(new Response(null, { status: 502 }));

    const [captured] = (Sentry.captureException as jest.Mock).mock.calls[0];
    expect(captured).toBeInstanceOf(Error);
    expect(captured.name).toBe('UserFacingError');
    expect(captured.message).toBe('move_to_card failed: HTTP_502');
  });

  it('wraps an error someone already captured, so the Ref points at a real event', () => {
    const error = new Error('paymaster rejected');
    Object.defineProperty(error, '__sentry_captured__', { value: true });

    report(error);

    const [captured] = (Sentry.captureException as jest.Mock).mock.calls[0];
    expect(captured).not.toBe(error);
    expect(captured.cause).toBe(error);
  });

  it('does not report expected failures on a toast, but still counts them', () => {
    expect(report(new TypeError('Network request failed'), 'toast')).toBeUndefined();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith(
      'error_shown',
      expect.objectContaining({ error_kind: 'offline' }),
    );
  });
});

describe('shouldReport', () => {
  it('gives every failed money action a Ref except the empty cases', () => {
    expect(shouldReport('insufficient_funds', 'sheet')).toBe(true);
    expect(shouldReport('rejected', 'sheet')).toBe(true);
    expect(shouldReport('offline', 'sheet')).toBe(false);
    expect(shouldReport('cancelled', 'sheet')).toBe(false);
    expect(shouldReport('rejected', 'toast')).toBe(false);
    expect(shouldReport('server', 'toast')).toBe(true);
  });
});

describe('activityFailureMetadata', () => {
  it('keeps the activity Ref when a Response request ID is found asynchronously in its body', async () => {
    const error = new Response(JSON.stringify({ requestId: RID }), { status: 500 });
    const activity = activityFailureMetadata(error);
    const normalized = await normalizeErrorAsync(error);
    const shown = reportUserError(normalized, describeError(normalized), 'sheet');
    expect(normalized.requestId).toBe(RID);
    expect(shown?.eventId).toBe(activity.errorEventId);
    expect(shown?.ref).toBe(activity.errorRef);
  });

  it('retains a request ID assigned by reporting before the activity is created', async () => {
    const error = new Response(JSON.stringify({ requestId: RID }), { status: 500 });
    const normalized = await normalizeErrorAsync(error);
    const shown = reportUserError(normalized, describeError(normalized), 'sheet');
    expect(activityFailureMetadata(error).errorEventId).toBe(shown?.eventId);
    expect(shown?.eventId).toBe(RID);
  });
  it('stores a sanitized cause and the Ref the user is about to see', () => {
    const error = new Error(
      'An internal error was received. URL: https://api.pimlico.io/v2/8453/rpc?apikey=pim_REDACTEDREDACTED',
    );

    const metadata = activityFailureMetadata(error);
    const shown = report(error);

    expect(metadata.error).toBe('An internal error was received. URL: https://api.pimlico.io/…');
    expect(metadata.errorRef).toBe(shown?.ref);
    expect(metadata.errorEventId).toBe(shown?.eventId);
  });
});

describe('error refs', () => {
  it('formats and compacts', () => {
    expect(formatErrorRef(RID)).toBe('9C1B-4F2A');
    expect(compactErrorRef('Ref 9c1b-4f2a')).toBe('9C1B4F2A');
  });
});

describe('buildSupportMessage', () => {
  it('prefills what failed, the amount, the time and both IDs', () => {
    const message = buildSupportMessage(
      'move_to_card',
      { ref: '9C1B-4F2A', eventId: RID, occurredAt: new Date(2026, 9, 11, 10, 56) },
      { amount: '50', token: 'USDC', network: 'Base' },
    );

    expect(message).toBe(
      [
        'Something failed in the app:',
        '',
        'What failed: Move to card',
        'Amount: 50 USDC',
        'Network: Base',
        'When: 11 Oct 2026 at 10:56',
        'Ref: 9C1B-4F2A',
        `Event ID: ${RID}`,
        '',
        'My question: ',
      ].join('\n'),
    );
  });
});

describe('buildSupportContext', () => {
  it('gives the in-house chat the event ID to resolve, and the Ref on the card', () => {
    expect(
      buildSupportContext('Couldn’t move to your card', {
        ref: '9C1B-4F2A',
        eventId: RID,
        occurredAt: new Date(),
      }),
    ).toEqual({ kind: 'error', id: RID, label: 'Couldn’t move to your card · Ref 9C1B-4F2A' });
  });
});

describe('reportUserError → admin Errors page', () => {
  const sink = jest.fn();
  beforeAll(() => setShownErrorSink(sink));
  afterAll(() => setShownErrorSink(undefined));
  beforeEach(() => sink.mockReset());

  it('sends a failure it gives no Ref straight to the Errors page', () => {
    const error = Object.assign(new Error('Too many requests'), { status: 429, requestId: RID });
    const normalized = normalizeError(error);
    const userError = describeError(normalized, { action: 'send' });
    expect(shouldReport(userError.kind, 'toast')).toBe(false);

    reportUserError(normalized, userError, 'toast');

    expect(reportClientError).not.toHaveBeenCalled();
    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'toast',
        flow: 'send',
        step: 'send',
        code: userError.code,
        refs: { requestId: RID },
      }),
    );
  });

  it('leaves a reported failure to clientErrors, which feeds the Errors page itself', () => {
    report(Object.assign(new Error('Internal server error'), { status: 500, requestId: RID }));
    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(sink).not.toHaveBeenCalled();
  });
});
