import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';

import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';

import { BackCircleIcon, InfoIcon } from './OrderIcons';
import { ReorderableScrollView, WEB_TOUCH } from './ReorderableList';

import type { ReactNode } from 'react';

const TOUCH_LIST_HINT = 'Hold and drag to reorder';
/** A mouse and keyboard: the web has no screen-reader row actions, so a focused row moves by key. */
const POINTER_LIST_HINT = WEB_TOUCH
  ? 'Hold and drag, or Alt + ↑/↓ to reorder'
  : 'Drag, or Alt + ↑/↓ to reorder';
/** A device whose main input is a mouse or trackpad, so it most likely has a keyboard too. */
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/**
 * The list hint for this device. Only a web page on a mouse-driven device names the keyboard moves:
 * a phone or tablet browser has no Alt or arrow keys, so it keeps the touch hint. Read after mount
 * (and on change, e.g. a mouse plugged into a tablet), so a statically rendered page hydrates with
 * the same text it was rendered with.
 */
const useDefaultListHint = () => {
  const [hasFinePointer, setHasFinePointer] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia(FINE_POINTER_QUERY);
    const update = () => setHasFinePointer(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return hasFinePointer ? POINTER_LIST_HINT : TOUCH_LIST_HINT;
};

export interface OrderEditorLayoutProps {
  /** "Spend order". */
  title: string;
  /** The line under the header. */
  intro: string;
  /** The info note under the intro. */
  note: string;
  /** "Order". */
  listLabel?: string;
  /** "Hold and drag to reorder"; on a mouse-driven web page it names the keyboard moves too. */
  listHint?: string;
  /** The {@link ReorderableList}. Auto-scrolls this screen's scroll view when placed here. */
  list: ReactNode;
  /** Under the list: a validation message, say. */
  listFooter?: ReactNode;
  /** "Preview". */
  previewLabel?: string;
  preview: ReactNode;
  /** Puts the default order on screen; nothing is saved until Save. */
  onReset: () => void;
  /** False while the saved order is still loading, so a Reset cannot become the save basis. */
  canReset?: boolean;
  resetAccessibilityLabel?: string;
  onSave: () => void;
  canSave: boolean;
  isSaving: boolean;
  saveAccessibilityLabel: string;
  /** Where back goes without a screen to return to. */
  fallbackHref: Href;
}

/**
 * The chrome an order screen is built in (Figma 30971:15157): the header with back, the title and
 * Reset; the intro and its info note; "Order" over the list; "Preview" over the preview; Save.
 *
 * Shared by the Spend order and Collateral order screens, which differ only in copy, list and
 * preview. The scroll view is the list's own ({@link ReorderableScrollView}), so a lifted row can
 * scroll the page and the page cannot scroll under it.
 */
const OrderEditorLayout = ({
  title,
  intro,
  note,
  listLabel = 'Order',
  listHint,
  list,
  listFooter,
  previewLabel = 'Preview',
  preview,
  onReset,
  canReset = true,
  resetAccessibilityLabel = 'Reset to the default order',
  onSave,
  canSave,
  isSaving,
  saveAccessibilityLabel,
  fallbackHref,
}: OrderEditorLayoutProps) => {
  const router = useRouter();
  const defaultListHint = useDefaultListHint();

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  }, [fallbackHref, router]);

  return (
    <PageLayout desktopOnly scrollable={false}>
      <View className="mx-auto w-full max-w-[600px] flex-1">
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="rounded-full transition-all active:scale-95 active:opacity-80"
            hitSlop={6}
            onPress={goBack}
            style={styles.back}
          >
            <BackCircleIcon />
          </Pressable>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            className="flex-1 text-center text-[20px] font-bold text-white"
          >
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={resetAccessibilityLabel}
            accessibilityState={{ disabled: !canReset }}
            className="active:opacity-80 disabled:opacity-50"
            disabled={!canReset}
            hitSlop={12}
            onPress={onReset}
            style={styles.reset}
          >
            <Text numberOfLines={1} className="text-right text-[16px] font-medium text-white/70">
              Reset
            </Text>
          </Pressable>
        </View>

        <ReorderableScrollView contentContainerStyle={styles.content}>
          <Text className="text-[16px] font-normal leading-[22px] text-white/70">{intro}</Text>

          <View style={styles.note}>
            <View style={styles.noteIcon}>
              <InfoIcon />
            </View>
            <Text className="flex-1 text-[14px] font-normal leading-[18px] text-white/60">
              {note}
            </Text>
          </View>

          <View style={[styles.label, styles.listLabel]}>
            <Text className="text-[18px] font-medium leading-[22px] text-white">{listLabel}</Text>
            <Text className="text-[14px] font-normal leading-[18px] text-white/50">
              {listHint ?? defaultListHint}
            </Text>
          </View>
          {list}
          {listFooter}

          <View style={[styles.label, styles.previewLabel]}>
            <Text className="text-[18px] font-medium leading-[22px] text-white">
              {previewLabel}
            </Text>
          </View>
          {preview}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saveAccessibilityLabel}
            accessibilityState={{ disabled: !canSave, busy: isSaving }}
            disabled={!canSave}
            onPress={onSave}
            className="bg-white transition-all active:scale-95 active:opacity-80 disabled:opacity-50"
            style={styles.save}
          >
            {isSaving ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text className="text-[16px] font-semibold text-black">Save</Text>
            )}
          </Pressable>
        </ReorderableScrollView>
      </View>
    </PageLayout>
  );
};

const styles = StyleSheet.create({
  // Figma 30971:15171: the 44pt back button, the title centred, "Reset" in a 44pt column.
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 17,
    paddingTop: 12,
  },
  back: { height: 44, width: 44 },
  reset: { alignItems: 'flex-end', width: 44 },
  // Figma: 17 from either edge, the intro 24 under the header, 40 under the button.
  content: { paddingBottom: 40, paddingHorizontal: 17, paddingTop: 24 },
  // Figma: 20 under the intro; 16 across, 14 down, the icon 10 before the text.
  note: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  // The 18pt icon on the first 18pt line of the note.
  noteIcon: { height: 18, width: 18 },
  // 12 above the panel each heads.
  label: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  // 28 after the note, and 28 after the list.
  listLabel: { marginTop: 28 },
  previewLabel: { marginTop: 28 },
  // Figma: 50 tall, fully round, 28 under the preview.
  save: {
    alignItems: 'center',
    borderRadius: 100,
    height: 50,
    justifyContent: 'center',
    marginTop: 28,
  },
});

export default OrderEditorLayout;
