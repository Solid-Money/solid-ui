import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

interface BackButtonProps {
  fallbackHref?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function BackButton({
  fallbackHref = '/',
  onPress,
  accessibilityLabel = 'Go back',
}: BackButtonProps) {
  const router = useRouter();

  const handlePress =
    onPress ?? (() => (router.canGoBack() ? router.back() : router.replace(fallbackHref as any)));

  return (
    <Pressable
      onPress={handlePress}
      className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-popover web:transition-colors web:hover:bg-muted"
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <ArrowLeft size={24} color="#FFFFFF" />
    </Pressable>
  );
}
