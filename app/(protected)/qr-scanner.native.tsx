/**
 * QR Scanner Route
 *
 * Expo Router screen for the general-purpose QR code scanner.
 * Supports different modes via query params:
 * - mode: 'send' | 'connect' | 'all' (default)
 * - title: Custom title text
 * - helperText: Custom helper text
 *
 * Usage:
 * router.push({ pathname: '/qr-scanner', params: { mode: 'send' } })
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { QRScannerScreen } from '@/components/QRScanner';
import { QRScannerMode } from '@/lib/qr/types';

type QRScannerParams = {
  mode?: QRScannerMode;
  title?: string;
  helperText?: string;
};

export default function QRScannerRoute() {
  const params = useLocalSearchParams<QRScannerParams>();

  // Validate mode param
  const mode: QRScannerMode =
    params.mode === 'send' || params.mode === 'connect' || params.mode === 'all'
      ? params.mode
      : 'all';

  return <QRScannerScreen mode={mode} title={params.title} helperText={params.helperText} />;
}
