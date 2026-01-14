import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { getColorForTransaction } from '@/lib/utils/cardHelpers';

interface AvatarProps {
  name: string;
  className?: string;
}

const getInitials = (text: string) => {
  if (!text) return '?';
  const firstChar = text.charAt(0).toUpperCase();
  if (/[0-9]/.test(firstChar)) return '0';
  return firstChar;
};

const Avatar = ({ name, className }: AvatarProps) => {
  return (
    <View
      className={cn('h-10 w-10 items-center justify-center rounded-full', className)}
      style={{ backgroundColor: getColorForTransaction(name).bg }}
    >
      <Text className="text-xl font-medium" style={{ color: getColorForTransaction(name).text }}>
        {getInitials(name)}
      </Text>
    </View>
  );
};

export default Avatar;
