/**
 * QR Scanner State Store
 *
 * Zustand store for managing QR scanner state including:
 * - Flash/torch state
 * - Recently scanned codes (for duplicate prevention)
 * - Scanner mode configuration
 * - Scan results
 */

import { create } from 'zustand';

import { QRParsedData, QRScannerMode } from '@/lib/qr/types';

/** Time window for duplicate detection (ms) */
const DUPLICATE_WINDOW_MS = 3000;

interface QRScannerState {
  /** Whether the camera flash/torch is enabled */
  flashEnabled: boolean;

  /** Current scanner mode (send, connect, all) */
  mode: QRScannerMode;

  /** Custom title for the scanner screen */
  title: string | null;

  /** Helper text shown below the scan area */
  helperText: string | null;

  /** Recently scanned codes with timestamps for duplicate detection */
  recentScans: Map<string, number>;

  /** Last successfully parsed QR data */
  lastScanResult: QRParsedData | null;

  /** Whether a scan is currently being processed */
  isProcessing: boolean;

  /** Toggle flash on/off */
  toggleFlash: () => void;

  /** Set the scanner mode */
  setMode: (mode: QRScannerMode) => void;

  /** Set custom title */
  setTitle: (title: string | null) => void;

  /** Set helper text */
  setHelperText: (text: string | null) => void;

  /** Check if a code was recently scanned (duplicate detection) */
  isRecentlyScanned: (code: string) => boolean;

  /** Record a scanned code */
  recordScan: (code: string) => void;

  /** Set the last scan result */
  setLastScanResult: (result: QRParsedData | null) => void;

  /** Set processing state */
  setIsProcessing: (processing: boolean) => void;

  /** Reset scanner state (call when closing scanner) */
  reset: () => void;

  /** Configure scanner with params */
  configure: (params: { mode?: QRScannerMode; title?: string; helperText?: string }) => void;
}

export const useQRScannerStore = create<QRScannerState>()((set, get) => ({
  flashEnabled: false,
  mode: 'all',
  title: null,
  helperText: null,
  recentScans: new Map(),
  lastScanResult: null,
  isProcessing: false,

  toggleFlash: () => {
    set(state => ({ flashEnabled: !state.flashEnabled }));
  },

  setMode: mode => {
    set({ mode });
  },

  setTitle: title => {
    set({ title });
  },

  setHelperText: text => {
    set({ helperText: text });
  },

  isRecentlyScanned: code => {
    const recentScans = get().recentScans;
    const lastScanTime = recentScans.get(code);

    if (!lastScanTime) return false;

    const now = Date.now();
    return now - lastScanTime < DUPLICATE_WINDOW_MS;
  },

  recordScan: code => {
    set(state => {
      const newScans = new Map(state.recentScans);
      const now = Date.now();

      // Add new scan
      newScans.set(code, now);

      // Clean up old scans
      for (const [key, timestamp] of newScans.entries()) {
        if (now - timestamp > DUPLICATE_WINDOW_MS * 2) {
          newScans.delete(key);
        }
      }

      return { recentScans: newScans };
    });
  },

  setLastScanResult: result => {
    set({ lastScanResult: result });
  },

  setIsProcessing: processing => {
    set({ isProcessing: processing });
  },

  reset: () => {
    set({
      flashEnabled: false,
      mode: 'all',
      title: null,
      helperText: null,
      recentScans: new Map(),
      lastScanResult: null,
      isProcessing: false,
    });
  },

  configure: params => {
    set({
      mode: params.mode || 'all',
      title: params.title || null,
      helperText: params.helperText || null,
    });
  },
}));
