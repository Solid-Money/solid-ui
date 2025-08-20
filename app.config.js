export default {
  expo: {
    name: "Solid",
    slug: "flash-frontend",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/images/adaptive-icon.png",
    scheme: "solid",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    owner: "fuseio",
    ios: {
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? "./GoogleService-Info.plist",
      supportsTablet: true,
      bundleIdentifier: "xyz.solid.ios",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      associatedDomains: [
        "webcredentials:solid.xyz",
        "applinks:solid.xyz",
      ],
      appleTeamId: "QC9255BHMY",
      splash: {
        image: "./assets/splash/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#94F27F"
      }
    },
    android: {
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#94F27F",
      },
      edgeToEdgeEnabled: true,
      package: "xyz.solid.android",
      splash: {
        image: "./assets/splash/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#94F27F"
      },
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "solid.xyz",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      [
        "expo-router",
        {
          headOrigin: process.env.HEAD_ORIGIN || "https://solid.xyz",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/splash/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#94F27F",
        },
      ],
      [
        "expo-font",
        {
          fonts: [
            "node_modules/@expo-google-fonts/mona-sans/200ExtraLight/MonaSans_200ExtraLight.ttf",
            "node_modules/@expo-google-fonts/mona-sans/300Light/MonaSans_300Light.ttf",
            "node_modules/@expo-google-fonts/mona-sans/400Regular/MonaSans_400Regular.ttf",
            "node_modules/@expo-google-fonts/mona-sans/500Medium/MonaSans_500Medium.ttf",
            "node_modules/@expo-google-fonts/mona-sans/600SemiBold/MonaSans_600SemiBold.ttf",
            "node_modules/@expo-google-fonts/mona-sans/700Bold/MonaSans_700Bold.ttf",
            "node_modules/@expo-google-fonts/mona-sans/800ExtraBold/MonaSans_800ExtraBold.ttf",
            "node_modules/@expo-google-fonts/mona-sans/900Black/MonaSans_900Black.ttf",
          ],
        },
      ],
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "15.1",
            useFrameworks: "static",
          },
          android: {
            compileSdkVersion: 35,
          },
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/adaptive-icon.png",
        },
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "a788e592-4267-44da-8afc-a667075c20d4",
      },
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    updates: {
      url: "https://u.expo.dev/a788e592-4267-44da-8afc-a667075c20d4",
    },
  },
};
