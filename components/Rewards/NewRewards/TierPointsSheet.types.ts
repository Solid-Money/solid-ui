import type { ReactElement } from 'react';

export interface TierPointsSheetProps {
  trigger?: ReactElement<{ onPress?: () => void }>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}
