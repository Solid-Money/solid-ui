import { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { CIRCULAR_CONTROL_CLASS_NAME } from '@/components/ui/circular-control';
import { cn } from '@/lib/utils';

interface BackButtonProps {
  fallbackHref?: Href | string;
  onPress?: () => void;
  accessibilityLabel?: string;
  variant?: 'default' | 'header' | 'hero';
  className?: string;
  icon?: ReactNode;
}

export function BackButton({
  fallbackHref = '/',
  onPress,
  accessibilityLabel = 'Go back',
  variant = 'default',
  className,
  icon,
}: BackButtonProps) {
  const router = useRouter();
  const isCompactHeaderButton = variant === 'header' || variant === 'hero';

  const handlePress =
    onPress ?? (() => (router.canGoBack() ? router.back() : router.replace(fallbackHref as Href)));

  return (
    <Pressable
      onPress={handlePress}
      className={cn(
        'flex items-center justify-center rounded-full border-0',
        isCompactHeaderButton
          ? cn(
              '-my-[3px] transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover',
              variant === 'hero' ? 'bg-[#111111]' : 'bg-[#2A2A2A]',
            )
          : 'bg-popover web:transition-colors web:hover:bg-muted',
        className,
        CIRCULAR_CONTROL_CLASS_NAME,
      )}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      {icon ?? <ArrowLeft size={isCompactHeaderButton ? 22 : 24} color="#FFFFFF" />}
    </Pressable>
  );
}
