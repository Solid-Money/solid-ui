# Solid

Frontend of your crypto savings app.

## Get started

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

3. Prebuild the ios and android directories

> [!IMPORTANT]  
> The thirdweb SDK uses native modules, which means it cannot run on expo GO. You must build the ios and android apps to link the native modules.

```bash
npx expo prebuild
```

This will create the `ios` and `android` directories.

4. Start the app

```bash
yarn ios
```

or

```bash
yarn android
```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).
