import { Linking, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { audits } from '@/constants/audits';
import { cn } from '@/lib/utils';

interface AuditsProps {
  className?: string;
}

const Audits = ({ className }: AuditsProps) => {
  return (
    <View className={cn('flex-1', className)}>
      {audits.map((audit, index) => (
        <Pressable
          key={`audit-${index}`}
          className={cn(
            'flex-row items-center justify-between py-4 hover:opacity-70',
            index === audits.length - 1 ? 'border-b-0' : 'border-b border-border',
          )}
          onPress={() => Linking.openURL(audit.url)}
        >
          <View className="flex-row items-center gap-2">
            <Image
              source={audit.image}
              style={{ width: 24, height: 24 }}
              contentFit="contain"
              alt={`${audit.name} security audit badge`}
            />
            <Text className="text-lg font-medium">{audit.name}</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Text className="text-lg font-medium">View audit</Text>
            <ChevronRight color="white" />
          </View>
        </Pressable>
      ))}
    </View>
  );
};

export default Audits;
