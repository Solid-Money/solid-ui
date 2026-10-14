import { ReactNode } from 'react';

import { ProfileRow } from '@/components/Profile/ProfileRow';

export interface SecurityRowBadge {
  label: string;
  tone: 'positive' | 'warning';
}

interface SecurityRowProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: SecurityRowBadge;
  /** Omit for a row that only reports state; it then shows no chevron. */
  onPress?: () => void;
  /** Swaps the badge for a spinner while the row's action is in flight. */
  isBusy?: boolean;
  accessibilityLabel?: string;
}

/**
 * One row of a Security group: icon, title, a line of detail, and on the
 * right an optional status badge and a chevron when the row leads somewhere.
 */
const SecurityRow = ({
  icon,
  title,
  subtitle,
  badge,
  onPress,
  isBusy,
  accessibilityLabel,
}: SecurityRowProps) => (
  <ProfileRow
    variant="hub"
    icon={icon}
    title={title}
    subtitle={subtitle}
    titleNumberOfLines={2}
    subtitleNumberOfLines={2}
    value={badge?.label}
    valueTone={badge?.tone}
    isLoading={isBusy}
    disabled={isBusy}
    onPress={onPress}
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ busy: !!isBusy }}
  />
);

export default SecurityRow;
