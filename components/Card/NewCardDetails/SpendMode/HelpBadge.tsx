import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';

/**
 * The 20pt "?" the spend-mode surfaces put beside a figure or a caption (Figma
 * exports it as a circle at 20% white with a plain type glyph). It explains
 * nothing yet — the copy behind it is a later pass.
 */
const HelpBadge = () => (
  <View style={styles.badge}>
    <Text className="text-[14px] font-normal leading-[16px] text-white/70">?</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
});

export default HelpBadge;
