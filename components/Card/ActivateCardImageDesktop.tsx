import { Image } from 'expo-image';

const ActivateCardImageDesktop = () => {
  return (
    <Image
      source={require('@/assets/images/activate_card_desktop.png')}
      contentFit="contain"
      style={{ width: 320, height: 377 }}
    />
  );
};

export default ActivateCardImageDesktop;
