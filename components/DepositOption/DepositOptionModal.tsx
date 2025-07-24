import { Plus } from "lucide-react-native";
import React, { useEffect } from "react";
import { View } from "react-native";
import { Address } from "viem";
import { useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";

import { Text } from "@/components/ui/text";
import { DEPOSIT_MODAL } from "@/constants/modals";
import getTokenIcon from "@/lib/getTokenIcon";
import { useDepositStore } from "@/store/useDepositStore";
import AnimatedModal from "../AnimatedModal";
import { DepositToVaultForm } from "../DepositToVault";
import TransactionStatus from "../TransactionStatus";
import { buttonVariants } from "../ui/button";
import DepositOptions from "./DepositOptions";

const DepositOptionModal = () => {
  const { currentModal, previousModal, transaction, setModal } = useDepositStore();
  const activeAccount = useActiveAccount();
  const status = useActiveWalletConnectionStatus();
  const address = activeAccount?.address;

  const isForm = currentModal.name === DEPOSIT_MODAL.OPEN_FORM.name;
  const isFormAndAddress = Boolean(isForm && address);
  const isTransactionStatus = currentModal.name === DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = currentModal.name === DEPOSIT_MODAL.CLOSE.name;
  const shouldAnimate = previousModal.name !== DEPOSIT_MODAL.CLOSE.name;
  const isForward = currentModal.number > previousModal.number;

  const getTrigger = () => {
    return (
      <View
        className={buttonVariants({
          variant: "brand",
          className: "h-12 pr-6 rounded-xl",
        })}
      >
        <View className="flex-row items-center gap-4">
          <Plus color="black" />
          <Text className="text-primary-foreground font-bold">
            Deposit
          </Text>
        </View>
      </View>
    )
  }

  const getContent = () => {
    if (isTransactionStatus) {
      return (
        <TransactionStatus
          amount={transaction.amount ?? 0}
          hash={transaction.hash ?? "" as Address}
          onPress={() => setModal(DEPOSIT_MODAL.CLOSE)}
          icon={getTokenIcon({ tokenSymbol: 'USDC' })}
        />
      );
    }

    if (isFormAndAddress) {
      return <DepositToVaultForm />;
    }

    return <DepositOptions />;
  };

  const getContentKey = () => {
    if (isTransactionStatus) return 'transaction-status';
    if (isFormAndAddress) return 'deposit-form';
    return 'deposit-options';
  };

  const getTitle = () => {
    if (isTransactionStatus) return undefined;
    return "Deposit";
  };

  const getContentClassName = () => {
    return "";
  };

  const getContainerClassName = () => {
    if (!isFormAndAddress && !isTransactionStatus) {
      return "min-h-[40rem]";
    }
    return "";
  };

  const handleOpenChange = (value: boolean) => {
    // Prevent closing when Reown modal is open
    if (!address && isForm) {
      return;
    }
    setModal(value ? DEPOSIT_MODAL.OPEN_OPTIONS : DEPOSIT_MODAL.CLOSE);
  };

  const handleBackPress = () => {
    setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
  };

  useEffect(() => {
    if (status === "disconnected" && !isClose) {
      setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    }
  }, [status, setModal, isClose]);

  return (
    <AnimatedModal
      currentModal={currentModal}
      previousModal={previousModal}
      isOpen={!isClose}
      onOpenChange={handleOpenChange}
      trigger={getTrigger()}
      title={getTitle()}
      contentClassName={getContentClassName()}
      containerClassName={getContainerClassName()}
      showBackButton={isFormAndAddress}
      onBackPress={handleBackPress}
      shouldAnimate={shouldAnimate}
      isForward={isForward}
      contentKey={getContentKey()}
    >
      {getContent()}
    </AnimatedModal>
  );
};

export default DepositOptionModal;
