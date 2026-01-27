/**
 * QRScannerCamera Component
 *
 * Camera view wrapper that combines:
 * - CameraView from expo-camera for barcode scanning
 * - Scanning overlay with corner markers
 * - Header controls
 * - Footer helper text
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarcodeScanningResult, CameraView } from 'expo-camera';

import { Text } from '@/components/ui/text';

import QRScannerHeader from './QRScannerHeader.native';
import QRScannerOverlay from './QRScannerOverlay.native';

interface QRScannerCameraProps {
  /** Title displayed in the header */
  title?: string;
  /** Helper text shown below the scan area */
  helperText?: string;
  /** Whether flash is currently enabled */
  flashEnabled: boolean;
  /** Callback when a barcode is scanned */
  onBarcodeScanned: (result: BarcodeScanningResult) => void;
  /** Callback to toggle flash */
  onToggleFlash: () => void;
  /** Callback to close the scanner */
  onClose: () => void;
}

const QRScannerCamera: React.FC<QRScannerCameraProps> = ({
  title = 'Scan QR Code',
  helperText = 'Point the camera at a QR code',
  flashEnabled,
  onBarcodeScanned,
  onToggleFlash,
  onClose,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={flashEnabled}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={onBarcodeScanned}
      />

      {/* Overlay with scan area */}
      <QRScannerOverlay />

      {/* Header with controls */}
      <QRScannerHeader
        title={title}
        flashEnabled={flashEnabled}
        onToggleFlash={onToggleFlash}
        onClose={onClose}
      />

      {/* Footer with helper text */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 32 }]}>
        <Text className="text-center text-base text-white/70">{helperText}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
  },
});

export default QRScannerCamera;
