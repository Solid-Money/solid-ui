import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

const COPIED_MS = 1500;
const MUTED = 'rgba(255, 255, 255, 0.5)';

interface ErrorRefChipProps {
  /** `9C1B-4F2A`. */
  errorRef: string;
  /** Extra analytics properties for the copy event. */
  analytics?: Record<string, unknown>;
}

/**
 * "Ref 9C1B-4F2A", tap to copy (Figma: Ref pill). The short GlitchTip event ID a
 * user can read out or paste to support; Contact support attaches it on its own.
 */
const ErrorRefChip = ({ errorRef, analytics }: ErrorRefChipProps) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(errorRef);
    track(TRACKING_EVENTS.ERROR_REF_COPIED, { error_ref: errorRef, ...analytics });
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }, [analytics, errorRef]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy error reference ${errorRef}`}
      onPress={handleCopy}
      className="flex-row items-center gap-1.5 rounded-full bg-white/[0.06] py-1.5 pl-3 pr-2.5 active:opacity-70 web:hover:bg-white/10"
    >
      <Text className="text-[13px] font-medium leading-[18px] text-white/50">
        {copied ? 'Copied' : `Ref ${errorRef}`}
      </Text>
      {copied ? <Check size={14} color={MUTED} /> : <Copy size={14} color={MUTED} />}
    </Pressable>
  );
};

export default ErrorRefChip;
