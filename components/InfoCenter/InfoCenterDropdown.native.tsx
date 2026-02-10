import { useCallback, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import {
  InfoCenterDocs,
  InfoCenterLegal,
  InfoCenterSupport,
  InfoCenterTrigger,
  onInfoCenterDocsPress,
  onInfoCenterLegalPress,
  useInfoCenterSupportPress,
} from '.';

const rowClassName = 'h-14 flex-row items-center gap-2 px-[30px]';

const InfoCenterDropdown = () => {
  const insets = useSafeAreaInsets();
  const onInfoCenterSupportPress = useInfoCenterSupportPress();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const handleSupportPress = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    onInfoCenterSupportPress();
  }, [onInfoCenterSupportPress]);

  const handleDocsPress = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    onInfoCenterDocsPress();
  }, []);

  const handleLegalPress = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    onInfoCenterLegalPress();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <View>
      <InfoCenterTrigger onPress={handlePresentModalPress} />
      <BottomSheetModal
        ref={bottomSheetModalRef}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#1c1c1c', borderRadius: 20 }}
        handleIndicatorStyle={{
          backgroundColor: 'rgba(255,255,255,0.2)',
          width: 74,
          height: 8,
        }}
      >
        <BottomSheetView className="gap-2 pb-2" style={{ paddingBottom: insets.bottom }}>
          <Pressable className={rowClassName} onPress={handleSupportPress}>
            <InfoCenterSupport />
          </Pressable>
          <Pressable className={rowClassName} onPress={handleDocsPress}>
            <InfoCenterDocs />
          </Pressable>
          <Pressable className={rowClassName} onPress={handleLegalPress}>
            <InfoCenterLegal />
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
};

export default InfoCenterDropdown;
