import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import getTokenIcon from '@/lib/getTokenIcon';
import { path } from '@/constants/path';
import { ArrowLeft } from 'lucide-react-native';
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
    <View className="flex-row items-center justify-between gap-2">
      <Pressable
        onPress={handleBackPress}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-popover web:transition-colors web:hover:bg-muted"
      >
        <ArrowLeft color="white" />
      </Pressable>
      {tokenSymbol && <RenderTokenIcon tokenIcon={tokenIcon} size={size} />}
      {title && (
        <Text className={cn('text-center text-lg font-semibold text-white', className)}>
          {title}
        </Text>
      )}
    </View>
  );
};

export default CoinBackButton;
