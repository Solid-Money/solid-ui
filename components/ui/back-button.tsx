import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { cn } from '@/lib/utils';

interface BackButtonProps {
  fallbackHref?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  variant?: 'default' | 'header';
}

export function BackButton({
  fallbackHref = '/',
  onPress,
  accessibilityLabel = 'Go back',
  variant = 'default',
}: BackButtonProps) {
  const router = useRouter();

  const handlePress =
    onPress ?? (() => (router.canGoBack() ? router.back() : router.replace(fallbackHref as any)));

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        'flex items-center justify-center rounded-full border-0',
        variant === 'header'
          ? '-my-[3px] h-[50px] w-[50px] bg-[#2A2A2A] transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover'
          : 'h-10 w-10 bg-popover web:transition-colors web:hover:bg-muted',
      )}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <ArrowLeft size={variant === 'header' ? 22 : 24} color="#FFFFFF" />
    </Pressable>
  );
}
