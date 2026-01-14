import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

export default function TabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView intensity={60} style={StyleSheet.absoluteFill} />
      <View style={styles.overlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
});
