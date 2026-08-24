import { ReactNode, useCallback, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getColorForTransaction, getInitials } from '@/lib/utils/cardHelpers';

type MerchantAvatarProps = {
  /** Resolved merchant name — see `getMerchantDisplay`. */
  name: string;
  /** Merchant logo from issuer enrichment, when there is one. */
  iconUrl?: string;
  size?: number;
  /** Class for the initials text in the default fallback. */
  textClassName?: string;
  /**
   * What to show instead of the default coloured initials. Pass this on a surface
   * with its own avatar treatment, so a logo that fails to load falls back to
   * that surface's own look rather than to a second, different one.
   */
  fallback?: ReactNode;
};

/**
 * A card transaction's merchant, as a logo when the issuer enriched one and as
 * coloured initials when it did not.
 *
 * Enrichment is optional and never arrives before settlement, so the initials
 * avatar is not a rare edge case — it is what a purchase looks like for its first
 * days, and what an unenrichable merchant looks like forever. A logo that fails
 * to load falls back to the same initials rather than leaving a blank circle.
 */
export default function MerchantAvatar({
  name,
  iconUrl,
  size = 44,
  textClassName,
  fallback,
}: MerchantAvatarProps) {
  const [iconFailed, setIconFailed] = useState(false);
  const handleError = useCallback(() => setIconFailed(true), []);

  if (iconUrl && !iconFailed) {
    return (
      <Image
        source={{ uri: iconUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#2A2A2A',
        }}
        alt={`${name} logo`}
        cachePolicy="memory-disk"
        transition={150}
        onError={handleError}
      />
    );
  }

  if (fallback) return <>{fallback}</>;

  const color = getColorForTransaction(name);

  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: color.bg }}
    >
      <Text className={textClassName ?? 'text-lg font-semibold'} style={{ color: color.text }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
