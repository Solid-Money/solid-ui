import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList, FlashListRef } from '@shopify/flash-list';
import { Sparkles } from 'lucide-react-native';

import {
  ContextCard,
  CsatPrompt,
  IncidentBanner,
  QuickReplies,
  TypingIndicator,
} from '@/components/Support/ChatExtras';
import Composer from '@/components/Support/Composer';
import MessageRow, {
  buildRows,
  ChatRow,
  markChatClosed,
  markChatOpened,
} from '@/components/Support/MessageRow';
import ReplayMask from '@/components/Support/ReplayMask';
import SupportIntroSheet from '@/components/Support/SupportIntroSheet';
import { Text } from '@/components/ui/text';
import { useSupportChatScreen } from '@/hooks/useSupportChat';
import { androidKeyboardLift, useChatKeyboard } from '@/lib/support/chatKeyboard';
import { loadOlder, sendMessage } from '@/lib/support/sync';
import { useSupportChatStore } from '@/store/useSupportChatStore';
import { useSupportIntroStore } from '@/store/useSupportIntroStore';
import { useUserStore } from '@/store/useUserStore';

import type { SupportFile } from '@/lib/types/support';

/** How close to the end (px) still counts as "at the bottom" for following new content. */
const AT_BOTTOM_SLACK = 120;

export const SUPPORT_EMAIL = 'hello@solid.xyz';

const Welcome = ({
  aiEnabled,
  expectedReplyText,
}: {
  aiEnabled: boolean;
  expectedReplyText: string | null;
}) => (
  <View className="mb-4 mt-2 items-center gap-2 px-6">
    <View className="h-12 w-12 items-center justify-center rounded-full bg-card">
      <Sparkles size={22} color="#94F27F" />
    </View>
    <Text className="text-center text-base font-semibold text-white">How can we help?</Text>
    <Text className="text-center text-sm leading-5 text-white/60">
      {aiEnabled
        ? 'Solid AI answers right away and hands over to our team when you need a person.'
        : 'Send us a message and our team will reply here.'}
      {expectedReplyText ? ` ${expectedReplyText}` : ''}
    </Text>
  </View>
);

/** Shown when the chat cannot load at all: retry, or email us instead. */
const Unreachable = ({ onRetry }: { onRetry: () => void }) => (
  <View className="flex-1 items-center justify-center gap-4 px-8">
    <Text className="text-center text-base font-semibold text-white">
      We could not load your messages
    </Text>
    <Text className="text-center text-sm leading-5 text-white/60">
      Check your connection and try again. If it keeps happening, email us at {SUPPORT_EMAIL} and we
      will reply there.
    </Text>
    <View className="flex-row gap-3">
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        className="rounded-full bg-brand px-5 py-2.5 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-brand-foreground">Try again</Text>
      </Pressable>
      <Pressable
        onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        accessibilityRole="button"
        className="rounded-full bg-card px-5 py-2.5 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-white">Email us</Text>
      </Pressable>
    </View>
  </View>
);

/**
 * The in-house support chat: one thread per user, newest at the bottom,
 * replies from Solid AI and the team arriving live over the app's socket.
 */
export default function SupportChat() {
  const { loadState, retry } = useSupportChatScreen();
  const insets = useSafeAreaInsets();
  const keyboard = useChatKeyboard();
  const androidLift =
    Platform.OS === 'android' ? androidKeyboardLift(keyboard.height, insets.bottom) : 0;
  const listRef = useRef<FlashListRef<ChatRow>>(null);
  const [offsetTop, setOffsetTop] = useState(0);
  const wrapperRef = useRef<View>(null);

  const loaded = useSupportChatStore(state => state.loaded);
  const messages = useSupportChatStore(state => state.messages);
  const pending = useSupportChatStore(state => state.pending);
  const currentCase = useSupportChatStore(state => state.currentCase);
  const aiTyping = useSupportChatStore(state => state.aiTyping);
  const aiActivity = useSupportChatStore(state => state.aiActivity);
  const incidents = useSupportChatStore(state => state.incidents);
  const ai = useSupportChatStore(state => state.ai);
  const hasOlder = useSupportChatStore(state => state.hasOlder);
  const draftContext = useSupportChatStore(state => state.draftContext);
  const setDraftContext = useSupportChatStore(state => state.setDraftContext);

  const rows = useMemo(() => buildRows(messages, pending), [messages, pending]);

  // What's already in the thread when it loads counts as seen; later messages rise in.
  const openedRef = useRef(false);
  useEffect(() => {
    if (!loaded || openedRef.current) return;
    openedRef.current = true;
    markChatOpened(useSupportChatStore.getState().messages.map(message => message.id));
  }, [loaded]);
  useEffect(() => markChatClosed, []);

  // "Meet Solid AI", once per account, the first time the chat opens.
  const userId = useUserStore(state => state.users.find(user => user.selected)?.userId);
  const introSeen = useSupportIntroStore(state => !userId || Boolean(state.seenByUserId[userId]));
  const markIntroSeen = useSupportIntroStore(state => state.markSeen);
  const showIntro = loaded && !introSeen && (ai?.enabled ?? true);
  const closeIntro = useCallback(() => {
    if (userId) markIntroSeen(userId);
  }, [markIntroSeen, userId]);
  const caseClosed = !currentCase || currentCase.status === 'resolved';
  const showQuickReplies = loaded && pending.length === 0 && caseClosed && !aiTyping;

  const send = useCallback(
    (body: string, files: SupportFile[]) => {
      const context = useSupportChatStore.getState().draftContext;
      sendMessage({
        body,
        files,
        context: context ? { kind: context.kind, id: context.id } : null,
      });
      if (context) setDraftContext(null);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    },
    [setDraftContext],
  );

  // The list follows new messages on its own, but not the footer: the typing indicator, the
  // rating card and the quick replies. Follow those too while the customer is at the bottom,
  // so "Solid AI is typing" shows up without scrolling. Someone reading older messages stays put.
  const atBottomRef = useRef(true);
  const footerHeightRef = useRef(0);
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    atBottomRef.current =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - AT_BOTTOM_SLACK;
  }, []);
  const handleFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    const grew = height > footerHeightRef.current;
    footerHeightRef.current = height;
    if (grew && atBottomRef.current) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, []);

  // The keyboard takes the bottom of the screen: keep the newest message in view above it,
  // unless the customer had scrolled up to read something older.
  useEffect(() => {
    if (Platform.OS !== 'android' || !keyboard.visible || !atBottomRef.current) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [keyboard.visible]);

  const handleOlder = useCallback(() => {
    if (hasOlder) loadOlder().catch(() => undefined);
  }, [hasOlder]);

  // The iOS keyboard avoider needs its distance from the top of the screen (the header above it).
  const measure = useCallback(() => {
    wrapperRef.current?.measureInWindow((_x, y) =>
      setOffsetTop(current => (current === y ? current : y)),
    );
  }, []);

  if (!loaded && loadState === 'error') return <Unreachable onRetry={retry} />;
  if (!loaded) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View ref={wrapperRef} onLayout={measure} className="flex-1">
      <KeyboardAvoidingView
        className="flex-1"
        // iOS only: on Android the lift below keeps the message bar above the keyboard.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        enabled={Platform.OS === 'ios'}
        keyboardVerticalOffset={offsetTop}
        style={androidLift > 0 ? { paddingBottom: androidLift } : undefined}
      >
        <ReplayMask style={{ flex: 1 }}>
          <IncidentBanner incidents={incidents} />
          <FlashList
            ref={listRef}
            data={rows}
            keyExtractor={row => row.key}
            getItemType={row =>
              row.type === 'message' ? `${row.type}-${row.message.author.type}` : row.type
            }
            renderItem={({ item }) => <MessageRow row={item} />}
            maintainVisibleContentPosition={{
              startRenderingFromBottom: true,
              autoscrollToBottomThreshold: 0.2,
            }}
            onScroll={handleScroll}
            scrollEventThrottle={64}
            onStartReached={handleOlder}
            onStartReachedThreshold={0.5}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}
            ListHeaderComponent={
              hasOlder ? (
                <View className="py-3">
                  <ActivityIndicator color="#6B6B6B" />
                </View>
              ) : rows.length === 0 ? (
                // Only on an empty thread: once there are messages it's just noise above them.
                <Welcome
                  aiEnabled={ai?.enabled ?? true}
                  expectedReplyText={ai?.expectedReplyText ?? null}
                />
              ) : null
            }
            ListFooterComponent={
              <View onLayout={handleFooterLayout}>
                {aiTyping && <TypingIndicator activity={aiActivity} />}
                {currentCase?.awaitingRating && (
                  <CsatPrompt key={currentCase.id} supportCase={currentCase} />
                )}
                {showQuickReplies && <QuickReplies onPick={text => send(text, [])} />}
              </View>
            }
          />
          {draftContext && (
            <ContextCard context={draftContext} onRemove={() => setDraftContext(null)} />
          )}
          <Composer onSend={send} bottomInset={keyboard.visible ? 0 : insets.bottom} />
        </ReplayMask>
        <SupportIntroSheet open={showIntro} onClose={closeIntro} />
      </KeyboardAvoidingView>
    </View>
  );
}
