import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { cn } from '@/lib/utils';

interface BackButtonProps {
  fallbackHref?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  variant?: 'default' | 'header' | 'hero';
}

export function BackButton({
  fallbackHref = '/',
  onPress,
  accessibilityLabel = 'Go back',
  variant = 'default',
}: BackButtonProps) {
  const router = useRouter();
  const isCompactHeaderButton = variant === 'header' || variant === 'hero';

  const handlePress =
    onPress ?? (() => (router.canGoBack() ? router.back() : router.replace(fallbackHref as any)));

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        'flex h-[50px] w-[50px] items-center justify-center rounded-full border-0',
        isCompactHeaderButton
          ? cn(
              '-my-[3px] transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover',
              variant === 'hero' ? 'bg-[#111111]' : 'bg-[#2A2A2A]',
            )
          : 'bg-popover web:transition-colors web:hover:bg-muted',
      )}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <ArrowLeft size={isCompactHeaderButton ? 22 : 24} color="#FFFFFF" />
    </Pressable>
  );
}
