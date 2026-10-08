import Toast, { type ToastShowParams } from 'react-native-toast-message';

import { isErrorIngestEnabled } from '@/lib/telemetry/errorIngestQueue';
import { reportError } from '@/lib/telemetry/reportError';
import { USER_CANCELLED_MESSAGE, userFacingErrorMessage } from '@/lib/utils/userFacingError';

/**
 * Every error toast, reported to the admin Errors page.
 *
 * An error toast is the one failure the user is certain to have seen, and there
 * are well over a hundred call sites showing them. Rather than touch each one,
 * `Toast.show` (a plain static on the library's component) is wrapped once at
 * startup, so a toast is reported with exactly the text it was shown with.
 */

const REPORTER_MARK = '__solidErrorReporter';

type MarkedShow = typeof Toast.show & { [REPORTER_MARK]?: true };

/**
 * A dismissed passkey or wallet prompt is a decision, not a failure, but some
 * screens still show it as an error toast. Those are reported as info so they
 * stay countable without reading as faults.
 */
export const isCancellationText = (text: string): boolean =>
  userFacingErrorMessage(text) === USER_CANCELLED_MESSAGE || /\bcancell?ed\b/i.test(text);

export const reportErrorToast = (params: ToastShowParams | undefined) => {
  if (params?.type !== 'error') return;
  const text1 = typeof params.text1 === 'string' ? params.text1.trim() : '';
  const text2 = typeof params.text2 === 'string' ? params.text2.trim() : '';
  const text = [text1, text2].filter(Boolean).join(' — ');
  if (!text) return;

  reportError({
    kind: 'toast',
    message: text,
    userMessage: text,
    severity: isCancellationText(text) ? 'info' : 'error',
  });
};

/** Wrap `Toast.show` once; safe to call again (including after a fast refresh). */
export const installToastReporter = () => {
  try {
    if (!isErrorIngestEnabled()) return;
    const original = Toast.show as MarkedShow;
    if (typeof original !== 'function' || original[REPORTER_MARK]) return;

    const show: MarkedShow = function (this: unknown, params: ToastShowParams) {
      const result = original.call(this, params);
      try {
        reportErrorToast(params);
      } catch {
        // Showing the toast is what matters.
      }
      return result;
    };
    show[REPORTER_MARK] = true;
    Toast.show = show;
  } catch {
    // Leave Toast untouched if anything about it is unexpected.
  }
};
