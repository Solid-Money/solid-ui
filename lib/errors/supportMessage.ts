import { format } from 'date-fns';

import { ERROR_ACTIONS, ErrorAction } from '@/lib/errors/actions';
import { ErrorDetails } from '@/lib/errors/classify';
import { ErrorReport } from '@/lib/errors/report';

const DATE_FORMAT = "d MMM yyyy 'at' HH:mm";

/**
 * The message a support chat opens with after a failure, so the user never has
 * to describe it or paste anything (Figma: 7 Support chat).
 *
 * Same layout as the "Question about transaction:" message the activity screen
 * prefills, which support already works from: one fact per line, then a line
 * for the user's own words.
 */
export const buildSupportMessage = (
  action: ErrorAction,
  report: ErrorReport | undefined,
  details?: ErrorDetails,
  occurredAt: Date = report?.occurredAt ?? new Date(),
): string => {
  const amount = [details?.amount, details?.token].filter(Boolean).join(' ');
  const lines = [
    'Something failed in the app:',
    '',
    `What failed: ${ERROR_ACTIONS[action].label}`,
    amount ? `Amount: ${amount}` : undefined,
    details?.network ? `Network: ${details.network}` : undefined,
    `When: ${format(occurredAt, DATE_FORMAT)}`,
    report ? `Ref: ${report.ref}` : undefined,
    report ? `Event ID: ${report.eventId}` : undefined,
    '',
    'My question: ',
  ];
  return lines.filter(line => line !== undefined).join('\n');
};
