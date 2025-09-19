import { Image } from 'expo-image';

const ActivateCardImageDesktop = () => {
  return (
    <Image
      source={require('@/assets/images/activate_card_desktop.png')}
      contentFit="contain"
      style={{ width: 321, height: 389 }}
    />
  );
};

export default ActivateCardImageDesktop;
