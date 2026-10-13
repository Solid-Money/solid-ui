import { Text } from '@/components/ui/text';
import { openHelpLink } from '@/lib/help/links';

const SavingDepositDescription = () => {
  return (
    <Text className="max-w-lg">
      <Text className="text-base font-medium opacity-70">
        Our Solid vault will automatically manage your funds to maximize your yield without exposing
        you to unnecessary risk.
      </Text>{' '}
      <Text
        accessibilityRole="link"
        onPress={() => openHelpLink('https://support.solid.xyz/en/articles/12156695-what-is-solid')}
        className="text-base font-medium text-primary hover:opacity-70 web:underline"
      >
        How it works
      </Text>
    </Text>
  );
};

export default SavingDepositDescription;
