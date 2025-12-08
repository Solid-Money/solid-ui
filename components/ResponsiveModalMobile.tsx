import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react-native';
import { View } from 'react-native';

interface ResponsiveModalMobileProps {
  containerClassName?: string;
  title?: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  titleClassName?: string;
  actionButton?: React.ReactNode;
  contentKey: string;
  children: React.ReactNode;
}

const ResponsiveModalMobile = ({
  containerClassName,
  title,
  showBackButton,
  onBackPress,
  titleClassName,
  actionButton,
  contentKey,
  children,
}: ResponsiveModalMobileProps) => {
  return (
    <View className={cn('gap-2 md:gap-6', containerClassName)}>
      {(title || (showBackButton && onBackPress)) && (
        <View
          className={cn(
            'flex-row items-center gap-2',
            showBackButton ? 'justify-between' : 'justify-center',
            titleClassName,
          )}
        >
          {showBackButton && onBackPress && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-transparent active:bg-transparent web:hover:bg-transparent web:hover:opacity-70"
              onPress={onBackPress}
            >
              <ArrowLeft color="white" size={20} />
            </Button>
          )}
          {title && (
            <View className="flex-1 items-center">
              <Text className="text-xl md:text-2xl font-semibold text-white text-center">
                {title}
              </Text>
            </View>
          )}
          {showBackButton && (actionButton ? actionButton : <View className="w-10" />)}
        </View>
      )}
      <View key={contentKey}>{children}</View>
    </View>
  );
};

export default ResponsiveModalMobile;
