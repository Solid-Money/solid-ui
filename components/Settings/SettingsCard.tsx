import { Href, Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  link?: Href;
  onPress?: () => void;
  isDesktop?: boolean;
  customAction?: React.ReactNode;
  titleStyle?: string;
  hideIconBackground?: boolean;
  inlineAction?: React.ReactNode;
}

interface CardContainerProps {
  link?: Href;
  onPress?: () => void;
  children: React.ReactNode;
}

const CardContainer = ({ link, onPress, children }: CardContainerProps) => {
  const isExternalUrl =
    typeof link === 'string' && (link.startsWith('http://') || link.startsWith('https://'));

  const handleExternalPress = () => {
    if (typeof link === 'string' && isExternalUrl) {
      if (Platform.OS === 'web') {
        window.open(link, '_blank');
      } else {
        Linking.openURL(link);
      }
    }
  };

  const pressableClass = 'active:opacity-70 transition-opacity';

  if (isExternalUrl) {
    return (
      <Pressable onPress={handleExternalPress} className={pressableClass}>
        {children}
      </Pressable>
    );
  } else if (link) {
    return (
      <Link href={link} className={pressableClass}>
        {children}
      </Link>
    );
  } else if (onPress) {
    return (
      <Pressable onPress={onPress} className={pressableClass}>
        {children}
      </Pressable>
    );
  } else {
    return <View>{children}</View>;
  }
};

const SettingsCard = ({
  title,
  description,
  icon,
  link,
  onPress,
  isDesktop,
  customAction,
  titleStyle,
  hideIconBackground,
  inlineAction,
}: SettingsCardProps) => {
  const hasLink = link || onPress;
  const iconContainerSize = isDesktop ? 'w-[50px] h-[50px]' : 'w-[50px] h-[50px]';
  const textSize = isDesktop ? 'text-lg' : 'text-base';
  const descTextSize = isDesktop ? 'text-base' : 'text-sm';
  const padding = isDesktop ? 'px-5 py-5' : 'px-5 py-4';
  const gap = isDesktop ? 'gap-5' : 'gap-3';

  return (
    <CardContainer link={link} onPress={onPress}>
      <View className={cn('w-full flex-row items-center justify-between', padding)}>
        <View className={cn('flex-row items-center flex-1', gap)}>
          <View
            className={cn(iconContainerSize, 'rounded-full items-center justify-center', {
              'bg-[#4d4d4d]': !hideIconBackground,
            })}
          >
            {icon}
          </View>
          <View className="flex-1">
            <Text className={cn('font-bold', textSize, titleStyle || 'text-white')}>{title}</Text>
            {description && (
              <View className="flex-row items-center">
                <Text className={cn(descTextSize, 'text-[#acacac] font-medium')}>
                  {description}
                </Text>
                {inlineAction && <View className="ml-0.5">{inlineAction}</View>}
              </View>
            )}
          </View>
        </View>
        {customAction ? customAction : hasLink && <ChevronRight size={20} color="#ffffff" />}
      </View>
    </CardContainer>
  );
};

export default SettingsCard;
