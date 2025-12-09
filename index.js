// Polyfills must be early to satisfy crypto/random usage across dependencies
import "react-native-get-random-values";

import { Platform } from "react-native";

if (Platform.OS !== "web") {
	import("@thirdweb-dev/react-native-adapter");
}

import "expo-router/entry";
import "react-native-reanimated";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";

// Disable strict mode warning - @rn-primitives reads shared values during render internally
configureReanimatedLogger({
	level: ReanimatedLogLevel.warn,
	strict: false,
});

