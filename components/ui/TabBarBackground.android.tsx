import { StyleSheet, View } from 'react-native';

export default function TabBarBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.topBorder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#111',
  },
  topBorder: {
    height: 1,
    backgroundColor: 'rgba(61, 61, 61, 0.5)',
  },
});
