import { Platform } from "react-native";

if (Platform.OS !== "web") {
	import("@thirdweb-dev/react-native-adapter");
}

import "expo-router/entry";
import "react-native-reanimated";

