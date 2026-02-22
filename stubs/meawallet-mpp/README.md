# Stub for @meawallet/react-native-mpp

This stub lets the app build and run when the real MeaWallet MPP package is not available (e.g. no Nexus registry auth).

**When real package available:** In the **root** `package.json`, replace:

```json
"@meawallet/react-native-mpp": "file:./stubs/meawallet-mpp"
```

with:

```json
"@meawallet/react-native-mpp": "^2.2.2"
```

Then configure the MeaWallet registry (see root `.npmrc` / docs) and run `npm install`.
