import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Updates from 'expo-updates';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { markOtaReloadRequested } from '@/lib/startupTiming';

// A check is one small request to the EAS Update server, but a user flipping
// between apps would otherwise fire one per switch.
const FOREGROUND_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Whether a downloaded update fixes something the running bundle must not keep
 * running with: it carries an `otaCriticalSince` time (app.config.ts puts it in
 * `extra`, which every update's manifest carries) later than when the running
 * bundle was published. Every update published after a critical one carries
 * the same time, so a later routine update still prompts devices that missed it.
 */
export const isCriticalUpdate = (
  update: Updates.UpdateInfo | undefined,
  runningCreatedAt: Date | undefined | null,
): boolean => {
  const manifest = update?.manifest as
    | { extra?: { expoClient?: { extra?: { otaCriticalSince?: unknown } } } }
    | undefined;
  const criticalSince = manifest?.extra?.expoClient?.extra?.otaCriticalSince;
  if (typeof criticalSince !== 'string') return false;
  const criticalAt = Date.parse(criticalSince);
  if (Number.isNaN(criticalAt)) return false;
  // A bundle with no publish time is the one built into the binary: older than any update.
  return criticalAt > (runningCreatedAt?.getTime() ?? 0);
};

/**
 * Finds a newer OTA bundle and lets the user switch to it without killing the app.
 *
 * Out of the box, expo-updates checks only on a cold start, downloads in the
 * background, and applies the bundle on the *next* cold start. iOS rarely
 * cold-starts an app — swiping home just suspends it — so devices kept running
 * an old bundle for weeks after a fix shipped.
 *
 * This hook adds a check each time the app returns to the foreground and
 * downloads whatever it finds, so the next cold start runs it. When the
 * downloaded bundle is critical for this device (see `isCriticalUpdate`),
 * `isUpdateReady` turns true and `applyUpdate` reloads the JS into it straight away.
 *
 * Native only: callers must not mount it on web, which has no expo-updates.
 */
export function useOtaUpdate() {
  const { isUpdatePending, isChecking, isDownloading, currentlyRunning, downloadedUpdate } =
    Updates.useUpdates();
  const [isApplying, setIsApplying] = useState(false);
  const [applyFailed, setApplyFailed] = useState(false);

  const busyRef = useRef(false);
  busyRef.current = isChecking || isDownloading;
  // The native launch check covers the first open, so start the clock now.
  const lastCheckRef = useRef(Date.now());

  useEffect(() => {
    if (!Updates.isEnabled) return;

    const checkAndDownload = async () => {
      if (busyRef.current) return;
      if (Date.now() - lastCheckRef.current < FOREGROUND_CHECK_INTERVAL_MS) return;
      lastCheckRef.current = Date.now();

      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
        }
      } catch (error) {
        // Offline or the update server is down; the next foreground retries.
        console.warn('OTA update check failed:', error);
      }
    };

    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') checkAndDownload();
    });
    return () => subscription.remove();
  }, []);

  // Only an update published as critical interrupts the user. Reloading throws
  // the running app away and starts it cold, and with updates going out several
  // times a day that put a second launch in front of most users. A routine one
  // stays downloaded and starts on the next cold launch, which is what
  // expo-updates does on its own.
  const isUpdateReady =
    Updates.isEnabled &&
    isUpdatePending &&
    isCriticalUpdate(downloadedUpdate, currentlyRunning.createdAt);
  const fromUpdateId = currentlyRunning.updateId;
  const toUpdateId = downloadedUpdate?.updateId;

  useEffect(() => {
    if (!isUpdateReady) return;
    track(TRACKING_EVENTS.OTA_UPDATE_PROMPT_SHOWN, { fromUpdateId, toUpdateId });
  }, [isUpdateReady, fromUpdateId, toUpdateId]);

  const applyUpdate = useCallback(async () => {
    setIsApplying(true);
    setApplyFailed(false);
    track(TRACKING_EVENTS.OTA_UPDATE_APPLIED, { fromUpdateId, toUpdateId });
    markOtaReloadRequested();
    try {
      // Resolves only if the reload fails; on success the JS context is replaced.
      await Updates.reloadAsync();
    } catch (error) {
      console.warn('OTA update reload failed:', error);
      track(TRACKING_EVENTS.OTA_UPDATE_FAILED, {
        fromUpdateId,
        toUpdateId,
        error: error instanceof Error ? error.message : String(error),
      });
      setApplyFailed(true);
      setIsApplying(false);
    }
  }, [fromUpdateId, toUpdateId]);

  return { isUpdateReady, isApplying, applyFailed, applyUpdate };
}
