import { reportError } from '@/lib/telemetry/reportError';
import { setShownErrorSink } from '@/lib/telemetry/shownErrors';

/**
 * Send the failures `lib/errors` shows without a Ref to the admin Errors page.
 * Called once by the root layout; `reportError` is inert in dev builds.
 */
export const installShownErrorReporter = () => {
  setShownErrorSink(reportError);
};
