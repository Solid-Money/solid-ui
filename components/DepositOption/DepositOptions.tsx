import { CreditCard, Landmark, Wallet } from "lucide-react-native"
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useAccount } from "wagmi"

import { useAppKit } from "@/lib/reown"
import { DEPOSIT_MODAL } from "@/constants/modals"
import { useDepositStore } from "@/store/useDepositStore"
import DepositOption from "./DepositOption"

const DepositOptions = () => {
  const { address } = useAccount();
  const { open } = useAppKit()
  const { setModal } = useDepositStore();

  const [isWalletOpen, setIsWalletOpen] = useState(false);

  const openWallet = useCallback(async () => {
    try {
      if (isWalletOpen) return;
      if (address) return;

      setIsWalletOpen(true);
      await open();
    } catch (error) {
      console.error(error);
    } finally {
      setIsWalletOpen(false);
      setModal(DEPOSIT_MODAL.OPEN_FORM);
    }
  }, [isWalletOpen, open]);

  const DEPOSIT_OPTIONS = [
    {
      text: "Connect Wallet",
      icon: <Wallet color="white" size={26} />,
      onPress: openWallet,
      isLoading: isWalletOpen
    },
    {
      text: "Debit/Credit Card",
      icon: <CreditCard color="white" size={26} />,
      onPress: () => {
        setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO);
      },
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
