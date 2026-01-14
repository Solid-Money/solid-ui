import { getAsset } from '@/lib/assets';
import { Image } from 'expo-image';

const ActivateCardImageDesktop = () => {
  return (
    <Image
      source={getAsset('images/activate_card_desktop.png')}
      contentFit="contain"
      style={{ width: 321, height: 389 }}
      alt="Solid debit card preview"
    />
  );
};

export default ActivateCardImageDesktop;
