import { Link } from 'expo-router';
import { Text } from '@/components/ui/text';

const SavingDepositDescription = () => {
  return (
    <Text className="max-w-lg">
      <Text className="text-base font-medium opacity-70">
        Our Solid vault will automatically manage your funds to maximize your yield without exposing
        you to unnecessary risk.
      </Text>{' '}
      <Link
        href="https://support.solid.xyz/en/articles/12156695-what-is-solid"
        target="_blank"
        className="text-base font-medium text-primary underline hover:opacity-70"
      >
        How it works
      </Link>
    </Text>
  );
};

export default SavingDepositDescription;
