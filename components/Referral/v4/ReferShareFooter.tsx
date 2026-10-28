import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import ReferQrSheet from './ReferQrSheet';
import ReferShareBar from './ReferShareBar';
import ReferShareSheet from './ReferShareSheet';
import { useReferShare } from './useReferShare';

/** Long enough for one sheet to finish closing before the next one rises. */
const SHEET_SWAP_DELAY_MS = 320;

interface ReferShareFooterProps {
  code: string;
  friendCreditUsd: number | undefined;
  surface: 'refer' | 'invites';
}

/**
 * The share bar pinned under the Refer screens, with the share options and the
 * QR code it opens. The sheets render through portals, so they can live here
 * beside the bar rather than in the page's overlay slot.
 */
const ReferShareFooter = ({ code, friendCreditUsd, surface }: ReferShareFooterProps) => {
  const share = useReferShare({ code, friendCreditUsd, surface });
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (swapTimer.current) clearTimeout(swapTimer.current);
    },
    [],
  );

  // From the share sheet: let it close before the QR sheet rises, so two sheets
  // never animate over each other.
  const showQrFromShare = useCallback(() => {
    setIsShareOpen(false);
    if (swapTimer.current) clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(() => setIsQrOpen(true), SHEET_SWAP_DELAY_MS);
  }, []);

  return (
    <View className="w-full px-4 pb-3 pt-2">
      <ReferShareBar
        share={share}
        code={code}
        onShare={() => setIsShareOpen(true)}
        onShowQr={() => setIsQrOpen(true)}
      />
      <ReferShareSheet
        isOpen={isShareOpen}
        onOpenChange={setIsShareOpen}
        share={share}
        friendCreditUsd={friendCreditUsd}
        onShowQr={showQrFromShare}
      />
      <ReferQrSheet isOpen={isQrOpen} onOpenChange={setIsQrOpen} share={share} surface={surface} />
    </View>
  );
};

export default ReferShareFooter;
