import { View } from 'react-native';
import { cn } from '@/lib/utils';
import { getColorForTransaction } from '@/lib/utils/cardHelpers';
import { Text } from '@/components/ui/text';

interface AvatarProps {
  name: string;
}

const getInitials = (text: string) => {
  if (!text) return '?';
  const firstChar = text.charAt(0).toUpperCase();
  if (/[0-9]/.test(firstChar)) return '0';
  return firstChar;
};

const Avatar = ({ name }: AvatarProps) => {
  return (
    <View
      className={cn('w-10 h-10 rounded-full items-center justify-center')}
      style={{ backgroundColor: getColorForTransaction(name).bg }}
    >
      <Text className="text-xl font-medium" style={{ color: getColorForTransaction(name).text }}>
        {getInitials(name)}
      </Text>
    </View>
  );
};

export default Avatar;
