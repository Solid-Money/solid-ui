/**
 * QRScannerHeader Component
 *
 * Header controls for the QR scanner including:
 * - Close button
 * - Title
 * - Flash/torch toggle
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flashlight, FlashlightOff, X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';

interface QRScannerHeaderProps {
  /** Title displayed in the header */
  title?: string;
  /** Whether flash is currently enabled */
  flashEnabled: boolean;
  /** Callback to toggle flash */
  onToggleFlash: () => void;
  /** Callback to close the scanner */
  onClose: () => void;
}

const QRScannerHeader: React.FC<QRScannerHeaderProps> = ({
  title = 'Scan QR Code',
  flashEnabled,
  onToggleFlash,
  onClose,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      {/* Close button */}
      <Pressable
        style={styles.button}
        onPress={onClose}
        hitSlop={20}
        accessibilityLabel="Close scanner"
        accessibilityRole="button"
      >
        <X size={24} color="white" />
      </Pressable>

      {/* Title */}
      <Text className="text-lg font-semibold text-white">{title}</Text>

      {/* Flash toggle */}
      <Pressable
        style={styles.button}
        onPress={onToggleFlash}
        hitSlop={20}
        accessibilityLabel={flashEnabled ? 'Turn off flash' : 'Turn on flash'}
        accessibilityRole="button"
        accessibilityState={{ checked: flashEnabled }}
      >
        {flashEnabled ? (
          <Flashlight size={24} color="#94F27F" />
        ) : (
          <FlashlightOff size={24} color="white" />
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default QRScannerHeader;
