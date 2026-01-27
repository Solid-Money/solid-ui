/**
 * QRScannerPermission Component
 *
 * Displays permission request UI when camera access is not granted.
 * Provides options to request permission or open device settings.
 */

import React, { useCallback } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Settings, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

interface QRScannerPermissionProps {
  /** Whether permission has been requested before */
  canAskAgain: boolean;
  /** Function to request camera permission */
  onRequestPermission: () => void;
  /** Function to close the scanner */
  onClose: () => void;
}

const QRScannerPermission: React.FC<QRScannerPermissionProps> = ({
  canAskAgain,
  onRequestPermission,
  onClose,
}) => {
  const insets = useSafeAreaInsets();

  const handleOpenSettings = useCallback(() => {
    track(TRACKING_EVENTS.QR_SCANNER_PERMISSION_REQUESTED, { via: 'settings' });

    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }, []);

  const handleRequestPermission = useCallback(() => {
    track(TRACKING_EVENTS.QR_SCANNER_PERMISSION_REQUESTED, { via: 'prompt' });
    onRequestPermission();
  }, [onRequestPermission]);

  return (
    <View style={styles.container}>
      {/* Close button */}
      <Pressable
        style={[styles.closeButton, { top: insets.top + 16 }]}
        onPress={onClose}
        hitSlop={20}
        accessibilityLabel="Close scanner"
        accessibilityRole="button"
      >
        <X size={24} color="white" />
      </Pressable>

      {/* Permission content */}
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Camera size={64} color="#94F27F" strokeWidth={1.5} />
        </View>

        <Text className="mb-4 text-center text-2xl font-bold text-white">
          Camera Access Required
        </Text>

        <Text className="mb-8 text-center text-base leading-6 text-white/70">
          To scan QR codes, Solid needs access to your camera.{'\n'}
          Your camera is only used for scanning.
        </Text>

        {canAskAgain ? (
          <Pressable
            style={styles.primaryButton}
            onPress={handleRequestPermission}
            accessibilityLabel="Allow camera access"
            accessibilityRole="button"
          >
            <Camera size={20} color="black" />
            <Text className="ml-2 text-base font-semibold text-black">Allow Camera Access</Text>
          </Pressable>
        ) : (
          <>
            <Text className="mb-4 text-center text-sm text-white/50">
              Camera permission was denied. Please enable it in Settings.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={handleOpenSettings}
              accessibilityLabel="Open settings"
              accessibilityRole="button"
            >
              <Settings size={20} color="black" />
              <Text className="ml-2 text-base font-semibold text-black">Open Settings</Text>
            </Pressable>
          </>
        )}

        <Pressable
          style={styles.secondaryButton}
          onPress={onClose}
          accessibilityLabel="Cancel"
          accessibilityRole="button"
        >
          <Text className="text-base font-medium text-white/70">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(148, 242, 127, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#94F27F',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 16,
    minWidth: 220,
  },
  secondaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});

export default QRScannerPermission;
