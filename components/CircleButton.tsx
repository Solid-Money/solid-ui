import { Pressable, View } from 'react-native';
import { SvgProps } from 'react-native-svg';

import { Text } from './ui/text';
import { cn } from '@/lib/utils';

interface CircleButtonProps {
  icon: React.ComponentType<SvgProps>;
  label: string;
  onPress?: () => void;
  backgroundColor?: string;
  iconColor?: string;
  scale?: number;
  viewBox?: string;
}

const CircleButton = ({
  icon: Icon,
  label,
  onPress,
  backgroundColor = 'bg-[#3A3A3A]',
  iconColor = '#ffffff',
  scale = 1,
  viewBox,
}: CircleButtonProps) => {
  // Extract dimensions from viewBox if provided
  const getDimensions = () => {
    if (!viewBox) return { width: 24, height: 24 };
    const [, , width, height] = viewBox.split(' ').map(Number);
    return { width: width * scale, height: height * scale };
  };

  const { width, height } = getDimensions();

  return (
    <Pressable className="gap-2 items-center" onPress={onPress}>
      <View className={cn('h-14 w-14 rounded-full items-center justify-center', backgroundColor)}>
        <Icon
          width={width}
          height={height}
          stroke={iconColor}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
        />
      </View>
      <Text className="text-muted-foreground font-medium">{label}</Text>
    </Pressable>
  );
};

export default CircleButton;
