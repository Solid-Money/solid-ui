/**
 * useQRScanner Hook
 *
 * Core hook for QR scanner functionality including:
 * - Barcode scan handling with haptic feedback
 * - Duplicate detection
 * - Type detection and parsing
 * - Mode-aware filtering
 * - Analytics tracking
 */

import { useCallback, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { handleQRCode, isTypeAllowedForMode, parseQRData } from '@/lib/qr';
import { QRParsedData, QRScannerMode } from '@/lib/qr/types';
import { useQRScannerStore } from '@/store/useQRScannerStore';

import { track } from '../lib/analytics';
import { TRACKING_EVENTS } from '../constants/tracking-events';

export interface UseQRScannerOptions {
  /** Scanner mode to filter allowed QR types */
  mode?: QRScannerMode;
  /** Callback when a valid QR code is scanned */
  onScanSuccess?: (data: QRParsedData) => void;
  /** Callback when scan fails or QR is not recognized */
  onScanError?: (message: string) => void;
  /** Whether to automatically handle navigation */
  autoNavigate?: boolean;
}

export interface UseQRScannerReturn {
  /** Handler for expo-camera barcode scan events */
  handleBarcodeScan: (result: BarcodeScanningResult) => void;
  /** Whether the flash is enabled */
  flashEnabled: boolean;
  /** Toggle flash on/off */
  toggleFlash: () => void;
  /** Whether a scan is currently being processed */
  isProcessing: boolean;
  /** Last successfully parsed QR data */
  lastScanResult: QRParsedData | null;
  /** Close the scanner and navigate back */
  closeScanner: () => void;
  /** Reset scanner state */
  resetScanner: () => void;
}

export function useQRScanner(options: UseQRScannerOptions = {}): UseQRScannerReturn {
  const { mode = 'all', onScanSuccess, onScanError, autoNavigate = true } = options;

  const processingRef = useRef(false);

  const {
    flashEnabled,
    isProcessing,
    lastScanResult,
    toggleFlash: storeToggleFlash,
    isRecentlyScanned,
    recordScan,
    setLastScanResult,
    setIsProcessing,
    reset,
  } = useQRScannerStore(
    useShallow(state => ({
      flashEnabled: state.flashEnabled,
      isProcessing: state.isProcessing,
      lastScanResult: state.lastScanResult,
      toggleFlash: state.toggleFlash,
      isRecentlyScanned: state.isRecentlyScanned,
      recordScan: state.recordScan,
      setLastScanResult: state.setLastScanResult,
      setIsProcessing: state.setIsProcessing,
      reset: state.reset,
    })),
  );

  const toggleFlash = useCallback(() => {
    storeToggleFlash();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [storeToggleFlash]);

  const handleBarcodeScan = useCallback(
    (result: BarcodeScanningResult) => {
      // Prevent concurrent processing
      if (processingRef.current || isProcessing) return;

      const { data } = result;
      if (!data) return;

      // Check for duplicate scans
      if (isRecentlyScanned(data)) {
        return;
      }

      // Mark as processing
      processingRef.current = true;
      setIsProcessing(true);
      recordScan(data);

      // Parse the QR data
      const parsed = parseQRData(data);

      // Track scan event
      track(TRACKING_EVENTS.QR_CODE_SCANNED, {
        type: parsed.type,
        mode,
      });

      // Check if type is allowed for current mode
      if (!isTypeAllowedForMode(parsed.type, mode)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        const modeMessage =
          mode === 'send'
            ? 'Please scan a wallet address QR code'
            : mode === 'connect'
              ? 'Please scan a WalletConnect QR code'
              : 'This QR code type is not supported';

        Toast.show({
          type: 'error',
          text1: 'Wrong QR Code Type',
          text2: modeMessage,
          position: 'bottom',
          visibilityTime: 3000,
        });

        onScanError?.(modeMessage);
        processingRef.current = false;
        setIsProcessing(false);
        return;
      }

      // Save result
      setLastScanResult(parsed);

      // Handle the QR code
      const result2 = handleQRCode(parsed);

      if (result2.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onScanSuccess?.(parsed);

        // Track successful scan
        track(TRACKING_EVENTS.QR_CODE_SCAN_SUCCESS, {
          type: parsed.type,
          mode,
        });

        // Navigate back if auto-navigate is enabled
        if (autoNavigate) {
          setTimeout(() => {
            if (router.canGoBack()) {
              router.back();
            }
          }, 100);
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        onScanError?.(result2.message || 'Failed to process QR code');

        // Track failed scan
        track(TRACKING_EVENTS.QR_CODE_SCAN_FAILED, {
          type: parsed.type,
          mode,
          error: result2.message,
        });
      }

      // Reset processing state after a delay to prevent rapid re-scans
      setTimeout(() => {
        processingRef.current = false;
        setIsProcessing(false);
      }, 1000);
    },
    [
      mode,
      isProcessing,
      isRecentlyScanned,
      recordScan,
      setIsProcessing,
      setLastScanResult,
      onScanSuccess,
      onScanError,
      autoNavigate,
    ],
  );

  const closeScanner = useCallback(() => {
    reset();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [reset]);

  const resetScanner = useCallback(() => {
    reset();
  }, [reset]);

  return {
    handleBarcodeScan,
    flashEnabled,
    toggleFlash,
    isProcessing,
    lastScanResult,
    closeScanner,
    resetScanner,
  };
}

export default useQRScanner;
