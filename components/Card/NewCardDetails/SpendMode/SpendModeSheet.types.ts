import type { SpendMode } from '@/components/Card/NewCardDetails/SpendMode/spendModes';

export interface SpendModeSheetProps {
  isOpen: boolean;
  /** Temporarily hides the drawer while its Home screen is behind another route. */
  isSuspended?: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The mode currently in force. Drives the white pill and turns the button into a
   * plain dismissal rather than a "Change to …".
   */
  activeMode?: SpendMode;
  /** The mode selected when the drawer body appears, including a restored preview. */
  initialMode?: SpendMode;
  /** Opens the spend-mode explanation from within this sheet. */
  onHelpPress: () => void;
  /** Opens the Credit page from the borrowed summary. */
  onViewCreditDetails: () => void;
  /** Opens the add-funds flow from the balance panel. */
  onAddFunds?: () => void;
  /** Opens the Spend order screen from "Edit order" on the Cash panel. */
  onEditOrder?: () => void;
}
