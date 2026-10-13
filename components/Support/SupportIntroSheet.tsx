import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { ShieldCheck, Sparkles, UsersRound } from 'lucide-react-native';

import SolidAiAvatar from '@/components/Support/SolidAiAvatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';

const POINTS = [
  { Icon: Sparkles, label: 'Answers in seconds, 24/7' },
  { Icon: UsersRound, label: 'Ask for a person anytime' },
  { Icon: ShieldCheck, label: 'Never asks for your passwords' },
] as const;

const rise = (delay: number) => FadeInDown.delay(delay).duration(380).springify().damping(18);

interface SupportIntroSheetProps {
  open: boolean;
  /** Closed either way (Start chatting, the backdrop, or a swipe): the intro is done. */
  onClose: () => void;
}

/**
 * "Meet Solid AI": shown once, the first time someone opens the support chat.
 * A bottom sheet on phones (native and web), a centred card on wider screens.
 *
 * Layout classes live on plain Views: on web, NativeWind classes on a
 * Reanimated `Animated.View` with `entering` are dropped.
 * Figma: Support intro — A2 · Meet Solid AI (app style, animated).
 */
export default function SupportIntroSheet({ open, onClose }: SupportIntroSheetProps) {
  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent
        webPresentation="bottom-sheet"
        nativePresentation="bottom-sheet"
        showCloseButton={false}
        className="w-full max-w-md overflow-hidden rounded-b-none rounded-t-[32px] border border-brand/20 bg-[#1C1C1C] p-0 md:rounded-b-[32px]"
      >
        <View className="items-center px-6 pb-10 pt-3 md:pb-8 md:pt-7">
          {/* Drag handle: only where it is a bottom sheet (phones). */}
          <View className="h-[5px] w-[73px] rounded-full bg-white/20 md:hidden" />

          {open && (
            <>
              <View className="mt-1 h-[148px] w-[180px] items-center justify-center md:mt-0">
                <Animated.View entering={ZoomIn.delay(150).springify().damping(14)}>
                  <SolidAiAvatar size={84} ripple="slow" />
                </Animated.View>
              </View>

              <Animated.View entering={rise(300)}>
                <Text className="text-center text-[30px] font-semibold leading-[34px] text-white">
                  Meet <Text className="text-[30px] font-semibold text-brand">Solid AI</Text>
                </Text>
              </Animated.View>
              <View className="mt-2">
                <Animated.View entering={rise(380)}>
                  <Text className="text-center text-base leading-[22px] text-white/70">
                    {'Instant answers, day or night.\nThe team is one message away.'}
                  </Text>
                </Animated.View>
              </View>

              <View className="mt-6 w-full overflow-hidden rounded-[20px] bg-[#2B2B2B]">
                {POINTS.map(({ Icon, label }, index) => (
                  <Animated.View key={label} entering={rise(460 + index * 80)}>
                    {index > 0 && <View className="h-px bg-white/10" />}
                    <View className="flex-row items-center gap-3 px-[18px] py-[15px]">
                      <Icon size={20} color="#94F27F" strokeWidth={1.75} />
                      <Text className="text-base font-medium text-white/85">{label}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>

              <View className="mt-6 w-full">
                <Animated.View entering={rise(760)}>
                  <Button
                    variant="brand"
                    className="h-12 w-full rounded-full"
                    onPress={onClose}
                    accessibilityLabel="Start chatting"
                  >
                    <Text className="text-base font-bold text-black">Start chatting</Text>
                  </Button>
                </Animated.View>
              </View>
            </>
          )}
        </View>
      </DialogContent>
    </Dialog>
  );
}
