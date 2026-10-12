import Toast from 'react-native-toast-message';

import { isMoneyAction } from '@/lib/errors/actions';
import {
  describeError,
  ErrorContext,
  ErrorSurface,
  normalizeErrorAsync,
  UserError,
} from '@/lib/errors/classify';
import { ErrorReport, reportUserError } from '@/lib/errors/report';
import { buildSupportContext, buildSupportMessage } from '@/lib/errors/supportMessage';
import { useFailureSheetStore } from '@/store/useFailureSheetStore';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

export type { ErrorAction } from '@/lib/errors/actions';
export { ERROR_ACTIONS, isMoneyAction } from '@/lib/errors/actions';
export type { ErrorContext, ErrorDetails, ErrorKind, UserError } from '@/lib/errors/classify';
export {
  getUserErrorMessage,
  isSafeServerMessage,
  normalizeError,
  normalizeErrorAsync,
  toUserError,
} from '@/lib/errors/classify';
export { formatErrorRef } from '@/lib/errors/errorRef';
export type { ErrorReport } from '@/lib/errors/report';
export { activityFailureMetadata, eventIdForError } from '@/lib/errors/report';
export { sanitizeTechnicalMessage } from '@/lib/errors/sanitize';
export { buildSupportContext, buildSupportMessage } from '@/lib/errors/supportMessage';

/** What every `show*` helper resolves with, for callers that log or branch on it. */
export interface ShownError {
  userError: UserError;
  report?: ErrorReport;
}

/**
 * Translate and report a failure. The shared first half of every `show*`
 * helper, exported for screens that render the error themselves (inline, or
 * on their own status screen) but still want the Ref.
 */
export const reportError = async (
  error: unknown,
  context: ErrorContext,
  surface: ErrorSurface,
  extraTags?: Record<string, string>,
): Promise<ShownError> => {
  const normalized = await normalizeErrorAsync(error);
  const userError = describeError(normalized, context);
  if (userError.silent) return { userError };
  return {
    userError,
    report: reportUserError(normalized, userError, surface, context.details, {
      ...context.tags,
      ...extraTags,
    }),
  };
};

/**
 * A failure that blocks nothing (Figma: Toast, Error): a background refresh,
 * copy, a setting that didn't save. Reported failures get a "Get help" action
 * that opens support with the Ref already in the message.
 *
 * Never for a failed money action; use {@link showFailureSheet}.
 */
export const showErrorToast = async (
  error: unknown,
  context: ErrorContext = {},
): Promise<ShownError> => {
  const shown = await reportError(error, context, 'toast');
  const { userError, report } = shown;
  if (userError.silent) return shown;

  // Intercom gets the prefilled message, the in-house chat the context card;
  // the support drawer picks whichever this user has.
  const supportRequest = report
    ? {
        chatMessage: buildSupportMessage(userError.action, report, context.details),
        context: buildSupportContext(userError.title, report),
      }
    : undefined;

  Toast.show({
    type: 'error',
    text1: userError.title,
    text2: userError.body,
    props: supportRequest
      ? { action: { label: 'Get help', onPress: () => openSupportDrawer(supportRequest) } }
      : undefined,
  });
  return shown;
};

/**
 * A failed money action (move, deposit, withdraw, swap, send, repay): the
 * failure sheet on phones, a centred dialog on desktop (Figma: 6 Failure sheet,
 * Web: failure dialog). Says what failed and whether money moved, offers Try
 * again and Contact support, and shows the Ref.
 */
export const showFailureSheet = async (
  error: unknown,
  context: ErrorContext & { onRetry?: () => void; retryLabel?: string } = {},
): Promise<ShownError> => {
  const shown = await reportError(error, context, 'sheet');
  const { userError, report } = shown;
  if (userError.silent) return shown;

  useFailureSheetStore.getState().open({
    action: userError.action,
    code: userError.code,
    title: userError.title,
    body: userError.body,
    nothingSent: userError.nothingSent,
    report,
    details: context.details,
    onRetry: context.onRetry,
    retryLabel: context.retryLabel,
  });
  return shown;
};

/**
 * Pick the surface from the action: money actions get the failure sheet,
 * everything else a toast. The default to reach for in a `catch`.
 */
export const showError = (
  error: unknown,
  context: ErrorContext & { onRetry?: () => void; retryLabel?: string } = {},
): Promise<ShownError> =>
  context.action && isMoneyAction(context.action)
    ? showFailureSheet(error, context)
    : showErrorToast(error, context);
