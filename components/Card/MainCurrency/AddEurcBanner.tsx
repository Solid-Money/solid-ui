import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

const EURC_LOGO = getAsset('images/eurc.png');

/**
 * "No EURC yet" (Figma 29246:9846): under the currency cards while the cardholder holds no
 * euros on Base, with the way to get some.
 */
const AddEurcBanner = ({ onAddEurc }: { onAddEurc: () => void }) => (
  <View style={styles.banner}>
    <Image source={EURC_LOGO} style={styles.logo} />
    <View style={styles.text}>
      <Text className="text-[16px] font-medium text-white">No EURC yet</Text>
      <Text className="text-[14px] text-white/60">Add EURC to pay in euros.</Text>
    </View>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add EURC"
      onPress={onAddEurc}
      className="bg-white transition-all active:scale-95 active:opacity-80"
      style={styles.button}
    >
      <Text className="text-[14px] font-semibold text-[#111111]">Add EURC</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    borderColor: '#3A3A3A',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  logo: { borderRadius: 16, height: 36, width: 36 },
  text: { flex: 1, gap: 3 },
  button: {
    alignItems: 'center',
    borderRadius: 100,
    height: 35,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});

export default AddEurcBanner;
