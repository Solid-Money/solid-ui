import type { SpendMode } from '@/components/Card/NewCardDetails/SpendMode/spendModes';

export interface SpendModeSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The mode currently in force. Drives the white pill and turns the button into a
   * plain dismissal rather than a "Change to …".
   */
  activeMode?: SpendMode;
  /** Opens the add-funds flow from the balance panel. */
  onAddFunds?: () => void;
}
