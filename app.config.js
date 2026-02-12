const IS_PROD = ['production', 'qa'].includes(process.env.EXPO_PUBLIC_ENVIRONMENT);

export default {
  expo: {
    name: 'Solid',
    slug: 'flash-frontend',
    version: '1.0.1',
    orientation: 'portrait',
    icon: './assets/images/adaptive-icon.png',
    scheme: 'solid',
    userInterfaceStyle: 'automatic',
    owner: 'fuseio',
    ios: {
      icon: './assets/images/ios-icon.png',
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? './GoogleService-Info.plist',
      supportsTablet: false,
      bundleIdentifier: 'app.solid.xyz',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: 'Solid needs camera access to scan QR codes for wallet addresses',
        NSUserTrackingUsageDescription: 'Solid uses this identifier to deliver personalized content and measure campaign effectiveness. You can change this anytime in Settings.',
        NSMicrophoneUsageDescription: "Access your microphone to transcribe voice messages in conversations",
      },
      privacyManifests: {
        NSPrivacyTracking: true,
        NSPrivacyTrackingDomains: ['api2.amplitude.com'],
        NSPrivacyCollectedDataTypes: [
          {
            // Device ID (IDFA) - collected by Amplitude, gated by ATT
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: true,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAnalytics'],
          },
          {
            // Crash Data - collected by Sentry
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCrashData',
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // Performance Data - collected by Sentry and Amplitude
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePerformanceData',
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            // User ID - used for account functionality
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
        ],
      },
      associatedDomains: ['webcredentials:solid.xyz', 'applinks:solid.xyz'],
      appleTeamId: '67UG7X46Z8',
      splash: {
        image: './assets/splash/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#94F27F',
      },
    },
    android: {
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#94F27F',
      },
      edgeToEdgeEnabled: true,
      package: 'xyz.solid.android',
      splash: {
        image: './assets/splash/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#94F27F',
      },
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'solid.xyz',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      bundler: 'metro',
      output: IS_PROD ? 'static' : 'single',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      [
        'expo-router',
        {
          headOrigin: process.env.HEAD_ORIGIN || 'https://solid.xyz',
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/splash/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#94F27F',
        },
      ],
      [
        'expo-font',
        {
          fonts: [
            'node_modules/@expo-google-fonts/mona-sans/200ExtraLight/MonaSans_200ExtraLight.ttf',
            'node_modules/@expo-google-fonts/mona-sans/300Light/MonaSans_300Light.ttf',
            'node_modules/@expo-google-fonts/mona-sans/400Regular/MonaSans_400Regular.ttf',
            'node_modules/@expo-google-fonts/mona-sans/500Medium/MonaSans_500Medium.ttf',
            'node_modules/@expo-google-fonts/mona-sans/600SemiBold/MonaSans_600SemiBold.ttf',
            'node_modules/@expo-google-fonts/mona-sans/700Bold/MonaSans_700Bold.ttf',
            'node_modules/@expo-google-fonts/mona-sans/800ExtraBold/MonaSans_800ExtraBold.ttf',
            'node_modules/@expo-google-fonts/mona-sans/900Black/MonaSans_900Black.ttf',
          ],
        },
      ],
      [
        'expo-build-properties',
        {
          ios: {
            deploymentTarget: '15.1',
            useFrameworks: 'static',
            forceStaticLinking: ['RNFBApp', 'RNFBMessaging', 'RNFBAnalytics']
          },
          android: {
            minSdkVersion: 26,
            compileSdkVersion: 36,
            enableProguardInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            extraProguardRules: `
              # JNA (Java Native Access) - WalletConnect dependency
              # JNA includes desktop-specific code paths that reference java.awt classes
              # These are not available on Android but also not used at runtime
              -dontwarn java.awt.**
              -dontwarn com.sun.jna.platform.win32.**
              -dontwarn com.sun.jna.platform.mac.**
              -dontwarn com.sun.jna.platform.unix.**

              # Fingerprint SDK - Google Play Services Location is optional
              # SDK uses location for enhanced device identification but works without it
              -dontwarn com.google.android.gms.location.**
            `,
          },
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/adaptive-icon.png',
        },
      ],
      '@react-native-firebase/app',
      '@react-native-firebase/messaging',
      [
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          project: 'solid',
          organization: 'fuse-4b',
        },
      ],
      // Fingerprint.com device intelligence - adds required Maven repo for Android
      '@fingerprintjs/fingerprintjs-pro-react-native',
      // Camera for QR code scanning
      [
        'expo-camera',
        {
          cameraPermission: 'Allow Solid to access your camera to scan QR codes',
        },
      ],
      [
        'expo-tracking-transparency',
        {
          userTrackingPermission:
            'Solid uses this identifier to deliver personalized content and measure campaign effectiveness. You can change this anytime in Settings.',
        }
      ],
      [
        '@intercom/intercom-react-native',
        {
          appId: process.env.EXPO_PUBLIC_INTERCOM_APP_ID,
          iosApiKey: process.env.EXPO_PUBLIC_INTERCOM_IOS_API_KEY,
          androidApiKey: process.env.EXPO_PUBLIC_INTERCOM_ANDROID_API_KEY,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'a788e592-4267-44da-8afc-a667075c20d4',
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/a788e592-4267-44da-8afc-a667075c20d4',
    },
  },
};
