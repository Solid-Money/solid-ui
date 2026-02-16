import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

export default function TabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Android blur with dimezisBlurView - lower intensity looks better on Android */}
      <BlurView
        intensity={25}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      {/* Darker overlay to compensate for Android's different blur rendering */}
      <View style={styles.overlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 17, 17, 0.5)',
  },
});
