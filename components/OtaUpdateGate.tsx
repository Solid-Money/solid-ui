import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useOtaUpdate } from '@/hooks/useOtaUpdate';

/**
 * Covers the whole app with an "update available" screen once a newer OTA
 * bundle has been downloaded, and reloads into it when the user taps Update now.
 *
 * It blocks on purpose: a fix only helps once devices run it. The one way past
 * it is a failed reload, so a broken update can never lock a user out.
 *
 * Mount once, last in the root tree so it sits above every screen and sheet,
 * and only on native.
 */
export default function OtaUpdateGate() {
  const { isUpdateReady, isApplying, applyFailed, applyUpdate } = useOtaUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!isUpdateReady || dismissed) return null;

  return (
    <View style={StyleSheet.absoluteFill} className="z-50 bg-background">
      <SafeAreaView edges={['bottom']} className="flex-1">
        {/* Shrinks on short screens so the copy and button always fit. */}
        <View className="min-h-0 flex-1 items-center justify-end">
          <Image
            source={require('@/assets/images/app-update-hero.png')}
            style={{ width: '100%', maxHeight: '100%', aspectRatio: 375 / 480 }}
            contentFit="contain"
            contentPosition="bottom"
          />
        </View>

        <View className="-mt-1.5 items-center gap-4 px-7">
          <View className="flex-row items-center gap-[7px] rounded-full bg-brand/15 py-1.5 pl-2.5 pr-3">
            <View className="h-1.5 w-1.5 rounded-full bg-brand" />
            <Text className="text-xs font-semibold uppercase leading-4 tracking-[0.72px] text-brand">
              New version
            </Text>
          </View>
          <Text className="max-w-[319px] text-center text-[30px] font-medium leading-[30px] tracking-[-0.9px]">
            New app update available
          </Text>
          <Text className="max-w-[300px] text-center text-base leading-5 text-white/70">
            {applyFailed
              ? "We couldn't restart the app. Try again, or keep using this version for now."
              : 'Please update to the latest version to keep earning, spending and moving.'}
          </Text>
        </View>

        <View className="gap-2 px-[18px] pb-4 pt-10">
          <Button
            variant="brand"
            className="h-12 w-full rounded-full"
            disabled={isApplying}
            onPress={applyUpdate}
          >
            {isApplying ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text className="text-base font-semibold">
                {applyFailed ? 'Try again' : 'Update now'}
              </Text>
            )}
          </Button>
          {applyFailed && (
            <Button
              variant="ghost"
              className="h-12 w-full rounded-full"
              disabled={isApplying}
              onPress={() => setDismissed(true)}
            >
              <Text className="text-base font-semibold">Not now</Text>
            </Button>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
