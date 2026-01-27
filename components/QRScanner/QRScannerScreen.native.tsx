/**
 * QRScannerScreen Component
 *
 * Main orchestrator for the QR scanner that handles:
 * - Camera permission flow
 * - Permission denied state with settings redirect
 * - Camera view with scanning
 * - Flash control
 * - Mode-aware scanning
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { useShallow } from 'zustand/react/shallow';

import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useQRScanner } from '@/hooks/useQRScanner';
import { track } from '@/lib/analytics';
import { QRScannerMode } from '@/lib/qr/types';
import { useQRScannerStore } from '@/store/useQRScannerStore';

import QRScannerCamera from './QRScannerCamera.native';
import QRScannerPermission from './QRScannerPermission.native';

interface QRScannerScreenProps {
  /** Scanner mode (send, connect, all) */
  mode?: QRScannerMode;
  /** Custom title for the header */
  title?: string;
  /** Custom helper text */
  helperText?: string;
}

const QRScannerScreen: React.FC<QRScannerScreenProps> = ({ mode = 'all', title, helperText }) => {
  const [permission, requestPermission] = useCameraPermissions();

  // Get configured values from store (can be overridden by props)
  const { storeTitle, storeHelperText, configure, reset } = useQRScannerStore(
    useShallow(state => ({
      storeTitle: state.title,
      storeHelperText: state.helperText,
      configure: state.configure,
      reset: state.reset,
    })),
  );

  // Use props if provided, otherwise fall back to store values
  const displayTitle = title || storeTitle || getDefaultTitle(mode);
  const displayHelperText = helperText || storeHelperText || getDefaultHelperText(mode);

  // Initialize the scanner hook
  const { handleBarcodeScan, flashEnabled, toggleFlash, closeScanner } = useQRScanner({
    mode,
    autoNavigate: true,
  });

  // Configure store on mount
  useEffect(() => {
    configure({ mode, title, helperText });

    // Track scanner opened
    track(TRACKING_EVENTS.QR_SCANNER_OPENED, { mode });

    return () => {
      // Track scanner closed and reset state
      track(TRACKING_EVENTS.QR_SCANNER_CLOSED, { mode });
      reset();
    };
  }, [mode, title, helperText, configure, reset]);

  // Track permission changes
  useEffect(() => {
    if (!permission) return;

    if (permission.granted) {
      track(TRACKING_EVENTS.QR_SCANNER_PERMISSION_GRANTED);
    } else if (!permission.granted && !permission.canAskAgain) {
      track(TRACKING_EVENTS.QR_SCANNER_PERMISSION_DENIED);
    }
  }, [permission]);

  // Loading state while checking permissions
  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#94F27F" />
        <Text className="mt-4 text-center text-base text-white/70">Initializing camera...</Text>
      </View>
    );
  }

  // Permission not granted - show permission request UI
  if (!permission.granted) {
    return (
      <QRScannerPermission
        canAskAgain={permission.canAskAgain}
        onRequestPermission={requestPermission}
        onClose={closeScanner}
      />
    );
  }

  // Permission granted - show camera
  return (
    <QRScannerCamera
      title={displayTitle}
      helperText={displayHelperText}
      flashEnabled={flashEnabled}
      onBarcodeScanned={handleBarcodeScan}
      onToggleFlash={toggleFlash}
      onClose={closeScanner}
    />
  );
};

/**
 * Get default title based on scanner mode
 */
function getDefaultTitle(mode: QRScannerMode): string {
  switch (mode) {
    case 'send':
      return 'Scan Address';
    case 'connect':
      return 'Scan to Connect';
    case 'all':
    default:
      return 'Scan QR Code';
  }
}

/**
 * Get default helper text based on scanner mode
 */
function getDefaultHelperText(mode: QRScannerMode): string {
  switch (mode) {
    case 'send':
      return 'Point the camera at a wallet address QR code';
    case 'connect':
      return 'Scan a WalletConnect QR code to connect';
    case 'all':
    default:
      return 'Point the camera at a QR code';
  }
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default QRScannerScreen;
