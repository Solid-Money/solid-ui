import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import getTokenIcon from '@/lib/getTokenIcon';
import { path } from '@/constants/path';
import { ChevronLeft } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import RenderTokenIcon from '@/components/RenderTokenIcon';

type CoinBackButtonProps = {
  title?: string;
  tokenSymbol?: string;
  size?: number;
  className?: string;
};

const CoinBackButton = ({ title, tokenSymbol, size = 32, className }: CoinBackButtonProps) => {
  const router = useRouter();

  const tokenIcon = getTokenIcon({
    tokenSymbol,
    size,
  });

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(path.HOME);
    }
  };

  return (
    <View className="flex-row items-center justify-between">
      <Pressable
        onPress={handleBackPress}
        className="flex-row items-center gap-2 web:hover:opacity-70"
      >
        <ChevronLeft color="white" />
        {tokenSymbol && <RenderTokenIcon tokenIcon={tokenIcon} size={size} />}
      </Pressable>
      {title && (
        <Text className={cn('text-white text-lg font-semibold text-center', className)}>
          {title}
        </Text>
      )}
      <View className="w-10" />
    </View>
  );
};

export default CoinBackButton;
