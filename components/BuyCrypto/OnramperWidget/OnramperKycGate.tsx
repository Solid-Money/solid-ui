import { type ReactNode, useState } from 'react';

import { useOnramperKycShare } from '@/hooks/useOnramperWidget';

import { OnramperKycConsent } from './OnramperKycConsent';
import { OnramperWidgetLoading } from './OnramperWidgetStates';

interface OnramperKycGateProps {
  /** Renders the widget once it is settled whether to share KYC. */
  children: (shareKyc: boolean) => ReactNode;
}

/**
 * Stands in front of the widget and settles whether this session shares the
 * user's Sumsub verification with Onramper.
 *
 * Only a user the backend says could share is asked; everyone else — Didit
 * users, the unverified, and anyone while the feature is off — goes straight
 * to the widget as before. A failed check counts as "can't share", so it never
 * blocks a purchase.
 *
 * Shared by the web and native widgets, so the consent step is the same on
 * both and the URL is minted only after the answer, never before.
 */
export const OnramperKycGate = ({ children }: OnramperKycGateProps) => {
  const { data, isPending } = useOnramperKycShare();
  const [shareKyc, setShareKyc] = useState<boolean | null>(null);

  if (shareKyc !== null) return children(shareKyc);
  if (isPending) return <OnramperWidgetLoading />;
  if (!data?.available) return children(false);

  return <OnramperKycConsent onDecide={setShareKyc} />;
};

export default OnramperKycGate;
