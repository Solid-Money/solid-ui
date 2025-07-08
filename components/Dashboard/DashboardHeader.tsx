import { Link } from "expo-router";
import { View } from "react-native";
import { DepositOptionModal } from "../DepositOption";
import { Text } from "../ui/text";
import WithdrawModal from "../Withdraw/WithdrawModal";

const DashboardHeader = () => {
  return (
    <View className="md:flex-row justify-between md:items-center gap-y-4">
      <View className="gap-3">
        <Text className="text-3xl font-semibold">
          Your saving account
        </Text>
        <Text className="max-w-lg">
          <Text className="opacity-70">
            Our Solid vault will automatically manage your funds to maximize your yield without exposing you to unnecessary risk.
          </Text>{" "}
          <Link href="https://solid-3.gitbook.io/solid.xyz-docs" target="_blank" className='text-primary font-medium underline hover:opacity-70'>How it works</Link>
        </Text>
      </View>
      <View className="flex-row items-center gap-5">
        <DepositOptionModal />
        <WithdrawModal />
      </View>
    </View>
  )
}

export default DashboardHeader;
