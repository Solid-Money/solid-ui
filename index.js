// 1. Reanimated FIRST - required for all animations/worklets
import "react-native-reanimated";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";

configureReanimatedLogger({
	level: ReanimatedLogLevel.warn,
	strict: false,
});

// 2. Crypto polyfill next (crypto deps like thirdweb rely on this)
import "react-native-get-random-values";

import { Platform } from "react-native";

if (Platform.OS !== "web") {
	import("@thirdweb-dev/react-native-adapter");  // 3. Thirdweb polyfills
}

// 4. LAST - Expo Router entry after all side effects
import "expo-router/entry";
