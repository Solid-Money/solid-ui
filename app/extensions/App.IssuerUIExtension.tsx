/**
 * Issuer UI Extension: auth screen for Apple Wallet add-card-from-wallet flow.
 * User authenticates; on success we store session in App Group and call completeAuthentication(true).
 * Requires: react-native-default-preference, App Group capability (e.g. group.app.solid.xyz).
 */
import React, { useCallback, useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const APP_GROUP_NAME = 'group.app.solid.xyz';

export default function IssuerUIExtension() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useCallback(async () => {
    setLoading(true);
    try {
      const [pref, mpp] = await Promise.all([
        import('react-native-default-preference'),
        import('@meawallet/react-native-mpp'),
      ]);
      const GroupPreference = pref.default;
      const MeaPushProvisioning = mpp.default;

      GroupPreference.setName(APP_GROUP_NAME);

      // TODO: Replace with real auth – call backend or reuse main app auth.
      // For now we store a placeholder; main app should write JWT/session after login.
      const session = { email, token: 'placeholder' };
      GroupPreference.set('session', JSON.stringify(session));

      (
        MeaPushProvisioning.ApplePay as unknown as {
          IssuerUIExtension: { completeAuthentication(ok: boolean): void };
        }
      ).IssuerUIExtension.completeAuthentication(true);
    } catch (_err) {
      const mpp = await import('@meawallet/react-native-mpp');
      (
        mpp.default.ApplePay as unknown as {
          IssuerUIExtension: { completeAuthentication(ok: boolean): void };
        }
      ).IssuerUIExtension.completeAuthentication(false);
    } finally {
      setLoading(false);
    }
  }, [email]);

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: '#000' }}>
      <View style={{ margin: 16 }}>
        <Text style={{ color: '#fff', marginBottom: 8 }}>Sign in to add your card</Text>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: '#444',
            marginBottom: 12,
            padding: 12,
            color: '#fff',
          }}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: '#444',
            marginBottom: 12,
            padding: 12,
            color: '#fff',
          }}
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Button title={loading ? 'Signing in...' : 'Log In'} onPress={login} disabled={loading} />
      </View>
    </SafeAreaView>
  );
}
