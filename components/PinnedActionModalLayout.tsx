import { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, X } from 'lucide-react-native';

const BACK_BUTTON_SIZE = 50;
const DEFAULT_ACTION_HEIGHT = 50;
const DEFAULT_ACTION_PADDING_TOP = 16;
const DEFAULT_ACTION_PADDING_BOTTOM = 55;
const DEFAULT_BACKGROUND = '#111111';
const DEFAULT_FADE_EXTENT = 120;

interface PinnedActionModalLayoutProps {
  action: ReactNode;
  actionFadeExtent?: number;
  actionHeight?: number;
  actionHorizontalPadding?: number;
  actionPaddingBottom?: number;
  actionPaddingTop?: number;
  backTopOffset?: number;
  backgroundColor?: string;
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  horizontalPadding?: number;
  onBack: () => void;
  topControl?: 'back' | 'close';
}

/**
 * Shared shell for immersive pop-ups: the content scrolls while navigation and
 * the primary action remain pinned inside the dialog. The fades keep content
 * moving underneath the controls without a hard visual edge.
 */
const PinnedActionModalLayout = ({
  action,
  actionFadeExtent = DEFAULT_FADE_EXTENT,
  actionHeight = DEFAULT_ACTION_HEIGHT,
  actionHorizontalPadding,
  actionPaddingBottom = DEFAULT_ACTION_PADDING_BOTTOM,
  actionPaddingTop = DEFAULT_ACTION_PADDING_TOP,
  backTopOffset = 8,
  backgroundColor = DEFAULT_BACKGROUND,
  children,
  contentContainerStyle,
  horizontalPadding = 18,
  onBack,
  topControl = 'back',
}: PinnedActionModalLayoutProps) => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 0);
  const actionBlockHeight = actionPaddingTop + actionHeight + bottomInset + actionPaddingBottom;

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={[contentContainerStyle, { paddingBottom: actionBlockHeight + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      <LinearGradient
        colors={[backgroundColor, `${backgroundColor}00`]}
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: backTopOffset + BACK_BUTTON_SIZE + DEFAULT_FADE_EXTENT,
        }}
      >
        <View
          style={{
            alignItems: topControl === 'close' ? 'flex-end' : 'flex-start',
            paddingTop: backTopOffset,
            paddingHorizontal: horizontalPadding,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={topControl === 'close' ? 'Close' : 'Go back'}
            onPress={onBack}
            className="h-[50px] w-[50px] items-center justify-center rounded-full bg-white/10 web:hover:bg-white/15"
          >
            {topControl === 'close' ? (
              <X color="#ffffff" size={22} />
            ) : (
              <ArrowLeft color="#ffffff" size={22} />
            )}
          </Pressable>
        </View>
      </LinearGradient>

      <LinearGradient
        colors={[`${backgroundColor}00`, backgroundColor, backgroundColor]}
        locations={[0, actionFadeExtent / (actionBlockHeight + actionFadeExtent), 1]}
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: actionBlockHeight + actionFadeExtent,
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            paddingHorizontal: actionHorizontalPadding ?? horizontalPadding,
            paddingTop: actionPaddingTop,
            paddingBottom: bottomInset + actionPaddingBottom,
          }}
        >
          {action}
        </View>
      </LinearGradient>
    </View>
  );
};

export default PinnedActionModalLayout;
