import { useLocalSearchParams } from 'expo-router';

import InviteScreen from '@/components/Invite/InviteScreen';

/**
 * `https://app.solid.xyz/invite/CODE` — the link a referrer shares. Public:
 * the person opening it doesn't have an account yet.
 */
export default function Invite() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <InviteScreen rawCode={code} />;
}
