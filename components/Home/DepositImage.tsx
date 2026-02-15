import { Image } from 'expo-image';

import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';

const DepositImage = () => {
  const { isScreenMedium } = useDimension();

  return (
    <Image
      source={getAsset('images/solid-tokens.png')}
      contentFit="contain"
      style={{
        ...(isScreenMedium && {
          position: 'absolute',
          right: isScreenMedium ? 50 : 0,
          top: '50%',
          transform: [{ translateY: '-50%' }],
        }),
        ...(!isScreenMedium && { marginLeft: 'auto', marginRight: 'auto' }),
        width: isScreenMedium ? 300 : 186,
        height: isScreenMedium ? 300 : 202,
      }}
      alt="Deposit illustration"
    />
  );
};

export default DepositImage;
