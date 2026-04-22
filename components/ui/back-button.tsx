import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

interface BackButtonProps {
  fallbackHref?: string;
}

export function BackButton({ fallbackHref = '/' }: BackButtonProps) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallbackHref as any))}
      className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-popover web:transition-colors web:hover:bg-muted"
    >
      <ChevronLeft size={24} color="#FFFFFF" />
    </Pressable>
  );
}
