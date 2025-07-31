import { Href, Link } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '../ui/text';

interface SettingsCardProps {
  title: string;
  description?: string;
  link?: Href;
  onPress?: () => void;
}

interface CardContainerProps {
  link?: Href;
  onPress?: () => void;
  children: React.ReactNode;
}

const CardContainer = ({ link, onPress, children }: CardContainerProps) => {
  return link ? (
    <Link href={link}>{children}</Link>
  ) : onPress ? (
    <Pressable onPress={onPress}>{children}</Pressable>
  ) : (
    <View>{children}</View>
  );
};

const SettingsCard = ({ title, description, link, onPress }: SettingsCardProps) => {
  const hasLink = link || onPress;

  return (
    <CardContainer link={link} onPress={onPress}>
      <View className="w-full p-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="w-10 h-10 bg-primary/10 rounded-full"></View>
          <View>
            <Text className="font-bold">{title}</Text>
            {description && (
              <Text className="text-sm text-muted-foreground font-medium">{description}</Text>
            )}
          </View>
        </View>
        {hasLink && <ChevronRight color="white" />}
      </View>
    </CardContainer>
  );
};

export default SettingsCard;
