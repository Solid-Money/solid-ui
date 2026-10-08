import { Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { getDeviceId } from '@amplitude/analytics-react-native';

import { enqueueErrorEvent, isErrorIngestEnabled } from '@/lib/telemetry/errorIngestQueue';
import { redactSecrets } from '@/lib/utils/userFacingError';

import type { ClientErrorEvent, ClientErrorKind, ErrorFlow, Severity } from '@/lib/telemetry/types';

/**
 * Report an app error to the admin Errors page.
 *
 * The single entry point for error toasts, failed API calls, crashes and failed
 * flows (see the installers next to this file). It fills in the device context,
 * strips credentials from free text, trims every field to what the ingest
 * endpoint accepts and queues the event; it never throws and never sends from a
 * dev build.
 */

export type ReportErrorInput = {
  kind: ClientErrorKind;
  /** Technical detail. Falls back to `userMessage`, then to the kind. */
  message?: string;
  /** Exactly what the user was shown. */
  userMessage?: string;
  flow?: ErrorFlow;
  step?: string;
  code?: string | number;
  severity?: Severity;
  httpStatus?: number;
  endpoint?: string;
  amplitudeEvent?: string;
  glitchtipEventId?: string;
  claimedUsername?: string;
  refs?: ClientErrorEvent['refs'];
  /** Defaults to the screen the root layout last reported. */
  screen?: string;
};

/** Field limits from the ingest contract. */
export const ERROR_FIELD_LIMITS = {
  step: 64,
  code: 64,
  message: 2000,
  userMessage: 500,
  screen: 200,
  appVersion: 32,
  endpoint: 200,
  claimedUsername: 64,
} as const;

let currentScreen: string | undefined;

/** Kept current by the root layout, so reports know where the user was. */
export const setCurrentScreen = (pathname: string | null | undefined) => {
  currentScreen = pathname || undefined;
};

/** Trimmed, cut to `max` characters (ending in an ellipsis), or undefined when empty. */
export const truncateField = (value: unknown, max: number): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const getPlatform = (): ClientErrorEvent['platform'] =>
  Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

let appVersion: string | undefined;

// The installed native version, as the promotions banner gate reads it. Web has
// no native version and always runs the latest build, so it reports the
// version in app.config.ts instead.
const getAppVersion = (): string | undefined => {
  if (appVersion === undefined) {
    try {
      appVersion =
        truncateField(
          Application.nativeApplicationVersion ?? Constants.expoConfig?.version,
          ERROR_FIELD_LIMITS.appVersion,
        ) ?? '';
    } catch {
      appVersion = '';
    }
  }
  return appVersion || undefined;
};

// Read from the SDK rather than lib/analytics, which imports this module.
const getAmplitudeDeviceId = (): string | undefined => {
  try {
    return getDeviceId() || undefined;
  } catch {
    return undefined;
  }
};

const fallbackUuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = (Math.random() * 16) | 0;
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });

const newEventId = (): string => {
  try {
    const id = Crypto.randomUUID();
    if (typeof id === 'string' && id) return id;
  } catch {
    // No native module (or no secure context on web): fall back below.
  }
  return fallbackUuid();
};

const cleanRefs = (refs: ReportErrorInput['refs']): ClientErrorEvent['refs'] => {
  if (!refs) return undefined;
  const entries = Object.entries(refs).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && !!entry[1],
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/** The event exactly as it will be sent. Exported for tests. */
export const buildClientErrorEvent = (
  input: ReportErrorInput,
  now: Date = new Date(),
): ClientErrorEvent => {
  const userMessage = input.userMessage ? redactSecrets(input.userMessage) : undefined;
  const message =
    truncateField(
      input.message?.trim() ? redactSecrets(input.message) : userMessage,
      ERROR_FIELD_LIMITS.message,
    ) ?? input.kind;

  return {
    id: newEventId(),
    ts: now.toISOString(),
    kind: input.kind,
    flow: input.flow,
    step: truncateField(input.step, ERROR_FIELD_LIMITS.step),
    code: truncateField(input.code, ERROR_FIELD_LIMITS.code),
    message,
    userMessage: truncateField(userMessage, ERROR_FIELD_LIMITS.userMessage),
    severity: input.severity,
    screen: truncateField(input.screen ?? currentScreen, ERROR_FIELD_LIMITS.screen),
    platform: getPlatform(),
    appVersion: getAppVersion(),
    httpStatus:
      typeof input.httpStatus === 'number' && Number.isFinite(input.httpStatus)
        ? input.httpStatus
        : undefined,
    endpoint: truncateField(input.endpoint, ERROR_FIELD_LIMITS.endpoint),
    amplitudeEvent: input.amplitudeEvent || undefined,
    glitchtipEventId: input.glitchtipEventId || undefined,
    deviceId: getAmplitudeDeviceId(),
    claimedUsername: truncateField(input.claimedUsername, ERROR_FIELD_LIMITS.claimedUsername),
    refs: cleanRefs(input.refs),
  };
};

export const reportError = (input: ReportErrorInput): void => {
  try {
    if (!isErrorIngestEnabled()) return;
    enqueueErrorEvent(buildClientErrorEvent(input));
  } catch {
    // Reporting an error must never become one.
  }
};
