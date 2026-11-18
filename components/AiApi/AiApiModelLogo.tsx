import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';

import type { AiApiModel } from '@/lib/types/ai-api';

/**
 * A model's logo in a circle with a hairline edge: the image uploaded from the
 * admin dashboard (Vercel Blob), loaded the same way on iOS, Android and web.
 * Without one, or when it fails to load, the provider's initial stands in.
 */
const AiApiModelLogo = ({
  model,
  size = 32,
}: {
  model: Pick<AiApiModel, 'name' | 'provider' | 'logoUrl'>;
  size?: number;
}) => {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = !!model.logoUrl && failed !== model.logoUrl;
  const initial = (model.provider || model.name).trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2 }}
      className="items-center justify-center overflow-hidden border border-white/[0.12] bg-[#2A2A2A]"
    >
      {showImage ? (
        <Image
          source={{ uri: model.logoUrl! }}
          style={{ width: size, height: size }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
          onError={() => setFailed(model.logoUrl)}
        />
      ) : (
        <Text
          style={{ fontSize: Math.round(size * 0.44) }}
          className="font-semibold text-white"
          accessible={false}
        >
          {initial}
        </Text>
      )}
    </View>
  );
};

export default AiApiModelLogo;
