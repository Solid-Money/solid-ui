import { Pressable, View } from 'react-native';
import { SvgProps } from 'react-native-svg';

import { cn } from '@/lib/utils';

import { Text } from './ui/text';

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
  backgroundColor = 'bg-[#2C2C2C]',
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
    <Pressable className="items-center gap-2" onPress={onPress}>
      <View className={cn('h-14 w-14 items-center justify-center rounded-full', backgroundColor)}>
        <Icon
          width={width}
          height={height}
          stroke={iconColor}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
        />
      </View>
      <Text className="font-medium text-primary/70">{label}</Text>
    </Pressable>
  );
};

export default CircleButton;
