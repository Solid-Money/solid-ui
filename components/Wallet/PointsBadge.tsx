import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '../ui/text';

type PointsBadgeProps = {
  points: number;
};

const PointsBadge = ({ points }: PointsBadgeProps) => {
  return (
    <LinearGradient
      colors={['rgba(229, 153, 254, 0.3)', 'rgba(229, 153, 254, 0.2)']}
      style={{
        borderRadius: 100,
        padding: 8,
        paddingLeft: 34,
        gap: 16,
        position: 'relative',
        minWidth: 120,
      }}
    >
      <Image
        source={require('@/assets/images/star.png')}
        style={{ width: 40, height: 40, position: 'absolute', top: 0, left: 8 }}
      />
      <Text className="text-points font-semibold">{points} Points</Text>
    </LinearGradient>
  );
};

export default PointsBadge;
