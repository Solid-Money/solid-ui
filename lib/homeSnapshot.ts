import { Platform } from 'react-native';

import mmkvStorage from '@/lib/mmvkStorage';
import { VaultType } from '@/lib/types';
import { useUserStore } from '@/store/useUserStore';

import type { Href } from 'expo-router';

/**
 * The last balance and Assets rows the home screen showed, kept per user so the
 * next launch or return to the app draws them straight away instead of
 * skeletons while the live figures load.
 *
 * The query cache (lib/queryPersistence) does the same job when it is restored,
 * but it is dropped wholesale on a cache or app version bump, after a week, and
 * after a crash, and a launch with nothing restored then waited on the slowest of
 * a dozen sources (30+ seconds for some accounts) before showing any figure.
 * This copy is the rendered result only: a few numbers and labels in a shape
 * this file owns, so nothing about how the figures are fetched can invalidate it.
 *
 * Shown only while the live figures load, always marked as updating, and never
 * fed into any calculation: it is a picture of the last screen, not data.
 */

export type HomeSnapshotIcon =
  | { type: 'yield'; vaultType: VaultType; badge?: 'lock' }
  | { type: 'token'; symbol: string; logoUrl?: string }
  /** One of the app's own portfolio marks (components/Assets/PortfolioIcon). */
  | { type: 'kind'; kind: 'usd' | 'eth' | 'fuse' | 'usdc' | 'card' };

export type HomeSnapshotAsset = {
  key: string;
  title: string;
  /** Plain text under the title. */
  subtitle?: string;
  /** Shown in green under the title, as "4.2% APY". */
  apy?: number;
  /** The amount column, in USD. Undefined draws "—". */
  value?: number;
  /** Replaces the amount column: EUR Yield's euro figure with the dollar estimate under it. */
  amountLines?: { primary: string; secondary?: string };
  icon: HomeSnapshotIcon;
  /** Where the row goes when pressed. */
  href: Href;
};

export type HomeSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  userId: string;
  savedAt: number;
  /** The headline, already in the display currency. */
  balance: { amount: number; symbol: string };
  hasFunds: boolean;
  hasCard: boolean;
  /** Every Assets row, largest first, as last drawn. */
  assets: HomeSnapshotAsset[];
};

export type HomeSnapshotInput = Omit<HomeSnapshot, 'version' | 'savedAt'>;

const SNAPSHOT_VERSION = 1;
const STORAGE_ID = 'home-snapshot';
const STORAGE_KEY = 'last';
/** The same horizon as the query cache: older figures are not worth showing. */
export const HOME_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Rewrite unchanged figures now and then so `savedAt` (reported as the age) stays honest. */
const REWRITE_UNCHANGED_AFTER_MS = 60_000;
const MAX_ASSETS = 25;

const canUseStorage = () => !(Platform.OS === 'web' && typeof window === 'undefined');

let storage: ReturnType<typeof mmkvStorage> | null = null;
const getStorage = () => {
  if (!storage && canUseStorage()) storage = mmkvStorage(STORAGE_ID);
  return storage;
};

// What is on disk, read once: MMKV is synchronous but a parse per render is waste.
let cached: HomeSnapshot | null | undefined;
let lastWrittenContent = '';
let lastWriteAt = 0;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** Absent, or a string with an optional string under it: anything else would reach a <Text>. */
const isAmountLines = (value: unknown): boolean => {
  if (value === undefined) return true;
  const lines = value as HomeSnapshotAsset['amountLines'];
  return (
    !!lines &&
    typeof lines.primary === 'string' &&
    (lines.secondary === undefined || typeof lines.secondary === 'string')
  );
};

const isAsset = (value: unknown): value is HomeSnapshotAsset => {
  const asset = value as HomeSnapshotAsset;
  return (
    !!asset &&
    typeof asset.key === 'string' &&
    typeof asset.title === 'string' &&
    (asset.value === undefined || isFiniteNumber(asset.value)) &&
    (asset.apy === undefined || isFiniteNumber(asset.apy)) &&
    (asset.subtitle === undefined || typeof asset.subtitle === 'string') &&
    !!asset.icon &&
    typeof asset.icon.type === 'string' &&
    isAmountLines(asset.amountLines) &&
    asset.href !== undefined
  );
};

/** Anything but the exact shape this file writes is dropped rather than drawn. */
const isSnapshot = (value: unknown): value is HomeSnapshot => {
  const snapshot = value as HomeSnapshot;
  return (
    !!snapshot &&
    snapshot.version === SNAPSHOT_VERSION &&
    typeof snapshot.userId === 'string' &&
    isFiniteNumber(snapshot.savedAt) &&
    !!snapshot.balance &&
    isFiniteNumber(snapshot.balance.amount) &&
    typeof snapshot.balance.symbol === 'string' &&
    typeof snapshot.hasFunds === 'boolean' &&
    typeof snapshot.hasCard === 'boolean' &&
    Array.isArray(snapshot.assets) &&
    snapshot.assets.every(isAsset)
  );
};

const loadFromDisk = (): HomeSnapshot | null => {
  try {
    const raw = getStorage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isSnapshot(parsed)) return parsed;
  } catch {
    // Unreadable: dropped below.
  }
  clearHomeSnapshot();
  return null;
};

/**
 * The last snapshot written for `userId`, or null: none, another user's, older
 * than {@link HOME_SNAPSHOT_MAX_AGE_MS}, or unreadable.
 */
export const readHomeSnapshot = (userId: string | undefined): HomeSnapshot | null => {
  if (!userId) return null;
  if (cached === undefined) cached = loadFromDisk();
  if (!cached || cached.userId !== userId) return null;
  if (Date.now() - cached.savedAt > HOME_SNAPSHOT_MAX_AGE_MS) return null;
  return cached;
};

const finiteOrUndefined = (value: number | undefined) =>
  isFiniteNumber(value) ? value : undefined;

/** JSON turns NaN into null, which the reader rightly refuses: drop such figures instead. */
const sanitizeAsset = (asset: HomeSnapshotAsset): HomeSnapshotAsset => ({
  ...asset,
  value: finiteOrUndefined(asset.value),
  apy: finiteOrUndefined(asset.apy),
});

/**
 * Remember what the home screen shows now. Call only with complete figures:
 * this is what the next launch draws before anything has loaded.
 */
export const saveHomeSnapshot = (input: HomeSnapshotInput): void => {
  if (!isFiniteNumber(input.balance.amount)) return;
  // Polls settle every few seconds with the same figures: write only what changed.
  const content = JSON.stringify({
    ...input,
    assets: input.assets.slice(0, MAX_ASSETS).map(sanitizeAsset),
  });
  const now = Date.now();
  if (content === lastWrittenContent && now - lastWriteAt < REWRITE_UNCHANGED_AFTER_MS) return;
  const snapshot: HomeSnapshot = {
    ...(JSON.parse(content) as HomeSnapshotInput),
    version: SNAPSHOT_VERSION,
    savedAt: now,
  };
  if (!isSnapshot(snapshot)) return;
  try {
    getStorage()?.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    cached = snapshot;
    lastWrittenContent = content;
    lastWriteAt = now;
  } catch (error) {
    console.warn('Could not save the home snapshot:', error);
  }
};

export const clearHomeSnapshot = (): void => {
  cached = null;
  lastWrittenContent = '';
  lastWriteAt = 0;
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
};

/**
 * Drops the snapshot as soon as the selected account changes (sign-out, switch),
 * so the next person on the device never sees the last one's figures, even for
 * a frame. Returns an unsubscribe function.
 */
export const guardHomeSnapshotOwner = (): (() => void) => {
  let ownerId = useUserStore.getState().users.find(user => user.selected)?.userId;
  return useUserStore.subscribe(state => {
    const userId = state.users.find(user => user.selected)?.userId;
    if (userId === ownerId) return;
    ownerId = userId;
    clearHomeSnapshot();
  });
};
