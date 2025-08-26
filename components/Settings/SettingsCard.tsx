import { Href, Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Linking, Platform, Pressable, View } from 'react-native';
import React from 'react';

import { Text } from '@/components/ui/text';

interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  link?: Href;
  onPress?: () => void;
  isDesktop?: boolean;
  customAction?: React.ReactNode;
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

  const pressableClass = "active:opacity-70 transition-opacity";

  if (isExternalUrl) {
    return <Pressable onPress={handleExternalPress} className={pressableClass}>{children}</Pressable>;
  } else if (link) {
    return <Link href={link} className={pressableClass}>{children}</Link>;
  } else if (onPress) {
    return <Pressable onPress={onPress} className={pressableClass}>{children}</Pressable>;
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
}: SettingsCardProps) => {
  const hasLink = link || onPress;
  const iconContainerSize = isDesktop ? 'w-[50px] h-[50px]' : 'w-[50px] h-[50px]';
  const textSize = isDesktop ? 'text-lg' : 'text-base';
  const descTextSize = isDesktop ? 'text-base' : 'text-sm';
  const padding = isDesktop ? 'px-5 py-5' : 'px-5 py-4';
  const gap = isDesktop ? 'gap-5' : 'gap-3';

  return (
    <CardContainer link={link} onPress={onPress}>
      <View className={`w-full ${padding} flex-row items-center justify-between`}>
        <View className={`flex-row items-center ${gap} flex-1`}>
          <View
            className={`${iconContainerSize} bg-[#4d4d4d] rounded-full items-center justify-center`}
          >
            {icon}
          </View>
          <View className="flex-1">
            <Text className={`font-bold ${textSize} text-white`}>{title}</Text>
            {description && (
              <Text className={`${descTextSize} text-[#acacac] font-medium mt-1`}>
                {description}
              </Text>
            )}
          </View>
        </View>
        {customAction ? customAction : hasLink && <ChevronRight size={20} color="#ffffff" />}
      </View>
    </CardContainer>
  );
};

export default SettingsCard;
