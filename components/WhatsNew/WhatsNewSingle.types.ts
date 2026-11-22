import type { WhatsNewSinglePopupProps } from './WhatsNewSinglePopup';
import type { WhatsNewDismissMethod } from '@/lib/whatsNew';

/** Why a single closed: a dismissal, or a tap on media that has a link. */
export type WhatsNewCloseReason = WhatsNewDismissMethod | 'click';

/**
 * The bottom drawer takes what the popup takes. It reports a close once its
 * slide-down has finished, so a link opens on a clear screen.
 */
export type WhatsNewSingleDrawerProps = WhatsNewSinglePopupProps;
