import { DEPOSIT_MODAL } from "@/constants/modals";
import { client } from "@/lib/thirdweb";
import { useDepositStore } from "@/store/useDepositStore";
import { Landmark, Wallet } from "lucide-react-native";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { useActiveAccount, useConnectModal } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import DepositOption from "./DepositOption";

const DepositOptions = () => {
  const activeAccount = useActiveAccount();
  const { connect } = useConnectModal();
  const { setModal } = useDepositStore();
  const address = activeAccount?.address;

  const [isWalletOpen, setIsWalletOpen] = useState(false);

  const openWallet = useCallback(async () => {
    try {
      if (isWalletOpen) return;
      if (address) return;

      setIsWalletOpen(true);
      await connect({
        client,
        showThirdwebBranding: false,
        size: "compact",
        wallets: [
          createWallet("walletConnect"),
          createWallet("io.rabby"),
          createWallet("io.metamask"),
        ]
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsWalletOpen(false);
      setModal(DEPOSIT_MODAL.OPEN_FORM);
    }
  }, [isWalletOpen, connect, address, setModal]);

  const DEPOSIT_OPTIONS = [
    {
      text: "Connect Wallet",
      icon: <Wallet color="white" size={26} />,
      onPress: openWallet,
      isLoading: isWalletOpen
    },
    {
      text: "Bank Deposit",
      icon: <Landmark color="white" size={26} />,
      onPress: () => { },
      isComingSoon: true
    }
  ]

  return (
    <View className="gap-y-2.5">
      {DEPOSIT_OPTIONS.map((option) => (
        <DepositOption
          key={option.text}
          text={option.text}
          icon={option.icon}
          onPress={option.onPress}
          isLoading={option.isLoading}
          isComingSoon={option.isComingSoon}
        />
      ))}
    </View>
  )
}

export default DepositOptions;
