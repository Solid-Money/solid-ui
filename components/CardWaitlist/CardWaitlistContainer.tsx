import { ImageBackground, Platform, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';

type CardWaitlistContainerProps = {
  children: React.ReactNode;
};

const CardWaitlistContainer = ({ children }: CardWaitlistContainerProps) => {
  const { isScreenMedium } = useDimension();

  return (
    <View
      className="relative overflow-hidden rounded-twice web:md:flex web:md:flex-row"
      style={{ minHeight: 470, ...(Platform.OS === 'web' ? {} : { borderRadius: 20 }) }}
    >
      <LinearGradient
        colors={['rgba(148, 242, 127, 0.2)', 'rgba(148, 242, 127, 0.032)']}
        locations={[0.1965, 0.7962]}
        start={{ x: 0.19, y: 0.11 }}
        end={{ x: 0.81, y: 0.89 }}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          zIndex: -1,
        }}
      />
      {isScreenMedium ? (
        <ImageBackground
          source={getAsset('images/cards-desktop.png')}
          resizeMode="contain"
          className={'flex-1'}
          imageStyle={{
            width: 452,
            height: 587,
            marginTop: isScreenMedium ? -60 : -50,
            marginRight: isScreenMedium ? 50 : -250,
            marginLeft: 'auto',
          }}
        >
          {children}
        </ImageBackground>
      ) : (
        <>{children}</>
      )}
    </View>
  );
};

export default CardWaitlistContainer;
