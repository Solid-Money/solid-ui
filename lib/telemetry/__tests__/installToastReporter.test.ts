/// <reference types="jest" />

import Toast from 'react-native-toast-message';

import { isErrorIngestEnabled } from '@/lib/telemetry/errorIngestQueue';
import { installToastReporter, isCancellationText } from '@/lib/telemetry/installToastReporter';
import { reportError } from '@/lib/telemetry/reportError';

jest.mock('@/lib/telemetry/errorIngestQueue', () => ({
  isErrorIngestEnabled: jest.fn(() => true),
}));
jest.mock('@/lib/telemetry/reportError', () => ({ reportError: jest.fn() }));

const mockReportError = reportError as jest.MockedFunction<typeof reportError>;
const mockEnabled = isErrorIngestEnabled as jest.MockedFunction<typeof isErrorIngestEnabled>;

describe('installToastReporter', () => {
  const librarysShow = Toast.show;
  let shown: jest.Mock;

  beforeEach(() => {
    mockReportError.mockReset();
    mockEnabled.mockReturnValue(true);
    shown = jest.fn();
    Toast.show = shown;
    installToastReporter();
  });

  afterAll(() => {
    Toast.show = librarysShow;
  });

  it('still shows every toast, and wraps only once', () => {
    const wrapped = Toast.show;
    installToastReporter();
    expect(Toast.show).toBe(wrapped);

    const params = { type: 'success', text1: 'Saved' };
    Toast.show(params);
    expect(shown).toHaveBeenCalledWith(params);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('reports an error toast with exactly the text it showed', () => {
    Toast.show({ type: 'error', text1: 'Deposit failed', text2: 'Please try again.' });

    expect(shown).toHaveBeenCalledTimes(1);
    expect(mockReportError).toHaveBeenCalledWith({
      kind: 'toast',
      message: 'Deposit failed — Please try again.',
      userMessage: 'Deposit failed — Please try again.',
      severity: 'error',
    });
  });

  it('reports a cancelled prompt as info', () => {
    Toast.show({ type: 'error', text1: 'Login failed', text2: 'User rejected the request.' });
    expect(mockReportError).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }));
  });

  it('skips error toasts with no text', () => {
    Toast.show({ type: 'error' });
    expect(shown).toHaveBeenCalledTimes(1);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it('shows the toast even when reporting breaks', () => {
    mockReportError.mockImplementation(() => {
      throw new Error('broken');
    });
    expect(() => Toast.show({ type: 'error', text1: 'Oops' })).not.toThrow();
    expect(shown).toHaveBeenCalledTimes(1);
  });

  it('leaves Toast alone when ingest is off', () => {
    Toast.show = shown;
    mockEnabled.mockReturnValue(false);
    installToastReporter();
    expect(Toast.show).toBe(shown);
  });
});

describe('isCancellationText', () => {
  it.each([
    'Request cancelled.',
    'Passkey prompt was cancelled',
    'NotAllowedError: The operation either timed out or was not allowed.',
    'User rejected the request.',
  ])('%s is a cancellation', text => {
    expect(isCancellationText(text)).toBe(true);
  });

  it.each(['Failed to cancel physical card — Please try again.', 'Insufficient balance'])(
    '%s is not',
    text => {
      expect(isCancellationText(text)).toBe(false);
    },
  );
});
