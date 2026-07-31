import { useCallback } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { useIntercom } from '@/lib/intercom';
import { closeSupportDrawer, useSupportDrawerStore } from '@/store/useSupportDrawerStore';

const FAQ_URL = 'https://support.solid.xyz/en/collections/16780872-troubleshooting';
const EMAIL_URL = 'mailto:hello@solid.xyz';
const HELP_CENTER_URL = 'https://support.solid.xyz';
const ACTION_DELAY_MS = 220;

const ChatIcon = () => (
  <Svg width={24} height={23} viewBox="0 0 23.724 22.0556" fill="none">
    <Path
      d="M16.8007 5.88889H21.7394C22.4213 5.88889 22.974 6.46408 22.974 7.17361V21.3056L18.8589 17.7482C18.6373 17.5565 18.3574 17.4514 18.0691 17.4514H8.15801C7.47611 17.4514 6.92334 16.8762 6.92334 16.1667V12.3125M16.8007 5.88889V2.03472C16.8007 1.3252 16.2479 0.75 15.566 0.75H1.98467C1.30279 0.75 0.75 1.3252 0.75 2.03472V16.1671L4.86516 12.609C5.08683 12.4175 5.36672 12.3125 5.65492 12.3125H6.92334M16.8007 5.88889V11.0278C16.8007 11.7373 16.2479 12.3125 15.566 12.3125H6.92334"
      stroke="white"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const FaqIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={10.25} stroke="white" strokeWidth={1.5} />
    <G transform="translate(7.784 6.024)">
      <Path
        d="M3.664 8.944C3.632 7.36 4.48 6.512 5.664 5.6C6.656 4.816 7.264 4.304 7.264 3.248C7.264 1.76 6.256 0.944 4.272 0.944C2.336 0.944 1.28 1.92 1.136 3.616H0C0.176 1.264 1.68 0 4.32 0C7.024 0 8.432 1.184 8.432 3.248C8.432 4.768 7.664 5.488 6.512 6.336C5.344 7.2 4.736 7.872 4.64 8.96L4.608 9.376H3.68L3.664 8.944ZM4.192 11.952C3.728 11.952 3.408 11.632 3.408 11.216C3.408 10.8 3.728 10.496 4.192 10.496C4.656 10.496 4.976 10.8 4.976 11.216C4.976 11.632 4.656 11.952 4.192 11.952Z"
        fill="white"
      />
    </G>
  </Svg>
);

const EmailIcon = () => (
  <Svg width={22} height={20} viewBox="0 0 21.5 18.9579" fill="none">
    <Path
      d="M1.86106 7.09705L8.74995 12.2637C9.93517 13.1525 11.5647 13.1525 12.75 12.2637L19.6388 7.09699"
      stroke="white"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M0.75 7.29322C0.75 6.48617 1.18753 5.74257 1.89301 5.35064L9.67078 1.02965C10.342 0.656783 11.158 0.656783 11.8292 1.02965L19.607 5.35064C20.3124 5.74257 20.75 6.48617 20.75 7.29322V15.9857C20.75 17.213 19.7551 18.2079 18.5278 18.2079H2.97222C1.74492 18.2079 0.75 17.213 0.75 15.9857V7.29322Z"
      stroke="white"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

const HelpCenterIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 21.5 21.5" fill="none">
    <Path
      d="M10.75 20.75C16.2728 20.75 20.75 16.2728 20.75 10.75C20.75 5.22715 16.2728 0.75 10.75 0.75C5.22715 0.75 0.75 5.22715 0.75 10.75C0.75 16.2728 5.22715 20.75 10.75 20.75Z"
      stroke="white"
      strokeWidth={1.5}
    />
    <Path
      d="M10.75 14.75C12.9591 14.75 14.75 12.9591 14.75 10.75C14.75 8.54086 12.9591 6.75 10.75 6.75C8.54086 6.75 6.75 8.54086 6.75 10.75C6.75 12.9591 8.54086 14.75 10.75 14.75Z"
      stroke="white"
      strokeWidth={1.5}
    />
    <Path d="M13.75 7.75L17.75 3.75" stroke="white" strokeWidth={1.5} />
    <Path d="M3.75 17.75L7.75 13.75" stroke="white" strokeWidth={1.5} />
    <Path d="M7.75 7.75L3.75 3.75" stroke="white" strokeWidth={1.5} />
    <Path d="M17.75 17.75L13.75 13.75" stroke="white" strokeWidth={1.5} />
  </Svg>
);

const ChevronIcon = () => (
  <Svg width={9} height={15} viewBox="0 0 8.85221 14.5" fill="none">
    <Path
      d="M0.750003 0.750003L7.75 7.25L0.750003 13.75"
      stroke="white"
      strokeOpacity={0.5}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);

interface SupportRowProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

const SupportRow = ({ icon, label, onPress }: SupportRowProps) => (
  <Pressable
    accessibilityLabel={label}
    accessibilityRole="button"
    className="h-[74px] flex-row items-center px-[23px] active:opacity-70 web:hover:bg-white/5 web:focus:outline-none"
    onPress={onPress}
  >
    <View className="h-6 w-6 items-center justify-center">{icon}</View>
    <Text className="ml-[19px] flex-1 text-[16px] font-medium leading-[22px] text-white">
      {label}
    </Text>
    <ChevronIcon />
  </Pressable>
);

const Divider = () => <View className="h-px bg-white/10" />;

const SupportDrawerContent = () => {
  const intercom = useIntercom();
  const chatMessage = useSupportDrawerStore(state => state.chatMessage);

  const runAfterDismiss = useCallback((action: () => void) => {
    closeSupportDrawer();
    setTimeout(action, ACTION_DELAY_MS);
  }, []);

  const handleChatPress = useCallback(() => {
    runAfterDismiss(() => {
      if (chatMessage) {
        intercom?.showNewMessage(chatMessage);
      } else {
        intercom?.show();
      }
    });
  }, [chatMessage, intercom, runAfterDismiss]);

  const openLink = useCallback(
    (url: string) => {
      runAfterDismiss(() => {
        void Linking.openURL(url);
      });
    },
    [runAfterDismiss],
  );

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <Text className="text-center text-[30px] font-semibold leading-[36px] text-white">
        Help & Support
      </Text>
      <View style={styles.card}>
        <SupportRow icon={<ChatIcon />} label="Chat with us" onPress={handleChatPress} />
        <Divider />
        <SupportRow icon={<FaqIcon />} label="FAQ" onPress={() => openLink(FAQ_URL)} />
        <Divider />
        <SupportRow
          icon={<EmailIcon />}
          label="Email Support"
          onPress={() => openLink(EMAIL_URL)}
        />
        <Divider />
        <SupportRow
          icon={<HelpCenterIcon />}
          label="Help center"
          onPress={() => openLink(HELP_CENTER_URL)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 73,
  },
  handle: {
    position: 'absolute',
    top: 16,
    left: '50%',
    width: 73,
    height: 5,
    marginLeft: -36.5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  card: {
    height: 299,
    marginTop: 43,
    marginHorizontal: '8%',
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#2b2b2b',
  },
});

export default SupportDrawerContent;
