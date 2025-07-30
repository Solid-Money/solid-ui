import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsCard } from '@/components/Settings';
import { accounts, supports } from '@/constants/settings';
import useUser from '@/hooks/useUser';

export default function Settings() {
  const { handleLogout } = useUser();

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom']}
    >
      <ScrollView className="flex-1">
        <View className="w-full max-w-7xl mx-auto gap-4 px-4 py-8">
          <View className="bg-card rounded-xl">
            {accounts.map((account, index) => (
              <SettingsCard
                key={`account-${index}`}
                title={account.title}
                description={account.description}
                link={account.link}
              />
            ))}
          </View>

          <View className="bg-card rounded-xl">
            {supports.map((support, index) => (
              <SettingsCard key={`support-${index}`} title={support.title} link={support.link} />
            ))}
          </View>

          <View className="bg-card rounded-xl">
            <SettingsCard key="logout" title="Logout" onPress={handleLogout} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
