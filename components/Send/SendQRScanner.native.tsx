/**
 * SendQRScanner - QR Scanner for Send Modal
 *
 * Renders QRScannerCamera within the Send modal system.
 * Handles address detection and navigates to Send form via modal state.
 *
 * Key integration points:
 * - Uses existing QRScannerCamera for the camera UI
 * - Uses useQRScanner hook with autoNavigate=false (we handle navigation via modal)
 * - On successful scan, handleQRCode sets SEND_MODAL.OPEN_FORM
 * - Camera cleanup happens automatically when React unmounts this component
 *
 * Note: Uses React Native's Modal component to render at root level,
 * bypassing the dialog's padding constraints for true fullscreen display.
 */

import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { useCameraPermissions } from 'expo-camera';

import QRScannerCamera from '@/components/QRScanner/QRScannerCamera.native';
import QRScannerPermission from '@/components/QRScanner/QRScannerPermission.native';
import { Text } from '@/components/ui/text';
import { SEND_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useQRScanner } from '@/hooks/useQRScanner';
import { track } from '@/lib/analytics';
import { useSendStore } from '@/store/useSendStore';

const SendQRScanner: React.FC = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const setModal = useSendStore(state => state.setModal);

  const { handleBarcodeScan, flashEnabled, toggleFlash } = useQRScanner({
    mode: 'send',
    autoNavigate: false, // We handle navigation via modal state change
  });

  // Custom close handler - go back to search
  const handleClose = useCallback(() => {
    setModal(SEND_MODAL.OPEN_SEND_SEARCH);
  }, [setModal]);

  // Track scanner opened/closed
  useEffect(() => {
    track(TRACKING_EVENTS.QR_SCANNER_OPENED, { mode: 'send', context: 'modal' });
    return () => {
      track(TRACKING_EVENTS.QR_SCANNER_CLOSED, { mode: 'send', context: 'modal' });
    };
  }, []);

  // Render content based on permission state
  const renderContent = () => {
    // Loading state while checking permissions
    if (!permission) {
      return (
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#94F27F" />
          <Text className="mt-4 text-center text-base text-white/70">Initializing camera...</Text>
        </View>
      );
    }

    // Permission not granted - show request UI
    if (!permission.granted) {
      return (
        <QRScannerPermission
          canAskAgain={permission.canAskAgain}
          onRequestPermission={requestPermission}
          onClose={handleClose}
        />
      );
    }

    // Camera view with scanner
    return (
      <QRScannerCamera
        title="Scan Address"
        helperText="Point the camera at a wallet address QR code"
        flashEnabled={flashEnabled}
        onBarcodeScanned={handleBarcodeScan}
        onToggleFlash={toggleFlash}
        onClose={handleClose}
      />
    );
  };

  // Use React Native Modal to render at root level, bypassing dialog padding
  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>{renderContent()}</View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SendQRScanner;
