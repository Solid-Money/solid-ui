import { useCallback, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';

import useUser from '@/hooks/useUser';

import {
  AccountCenterSettings,
  AccountCenterSignOut,
  AccountCenterTrigger,
  AccountCenterUsername,
  onAccountCenterSettingsPress,
} from '.';

const rowClassName = 'h-14 flex-row items-center gap-2 px-[30px]';

const AccountCenterDropdown = () => {
  const insets = useSafeAreaInsets();
  const { handleLogout } = useUser();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const handleSettingsPress = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    onAccountCenterSettingsPress();
  }, []);

  const handleSignOutPress = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
    handleLogout();
  }, [handleLogout]);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
    [],
  );

  return (
    <View>
      <AccountCenterTrigger onPress={handlePresentModalPress} />
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
          <View className={rowClassName}>
            <AccountCenterUsername />
          </View>
          <View className="mx-[30px] h-px bg-border/50" />
          <Pressable className={rowClassName} onPress={handleSettingsPress}>
            <AccountCenterSettings />
          </Pressable>
          <Pressable className={rowClassName} onPress={handleSignOutPress}>
            <AccountCenterSignOut />
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
};

export default AccountCenterDropdown;
