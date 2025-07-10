import { ArrowLeft, Plus } from "lucide-react-native";
import React, { useEffect } from "react";
import { Easing, View } from "react-native";
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useAccount } from "wagmi";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { DEPOSIT_MODAL } from "@/constants/modals";
import { cn } from "@/lib/utils";
import { useDepositStore } from "@/store/useDepositStore";
import BuyCrypto from "../BuyCrypto";
import { DepositToVaultForm } from "../DepositToVault";
import TransactionStatus from "../TransactionStatus";
import { Button, buttonVariants } from "../ui/button";
import DepositOptions from "./DepositOptions";

const ANIMATION_DURATION = 150;

const DepositOptionModal = () => {
  const { depositModal, previousDepositModal, transaction, setDepositModal } =
    useDepositStore();
  const { address, status } = useAccount();

  const isForm = depositModal.name === DEPOSIT_MODAL.OPEN_FORM.name;
  const isFormAndAddress = isForm && address;
  const isBuyCrypto = depositModal.name === DEPOSIT_MODAL.OPEN_BUY_CRYPTO.name;
  const isTransactionStatus = depositModal.name === DEPOSIT_MODAL.OPEN_TRANSACTION_STATUS.name;
  const isClose = depositModal.name === DEPOSIT_MODAL.CLOSE.name;
  const shouldAnimate = previousDepositModal.name !== DEPOSIT_MODAL.CLOSE.name;

  const isForward = depositModal.number > previousDepositModal.number;

  const dialogHeight = useSharedValue(0);

  const dialogAnimatedStyle = useAnimatedStyle(() => {
    if (!shouldAnimate) {
      return {
        height: dialogHeight.value,
      };
    }
    return {
      height: withTiming(dialogHeight.value, {
        duration: ANIMATION_DURATION,
        easing: Easing.inOut(Easing.quad),
      }),
    };
  });

  useEffect(() => {
    if (status === "disconnected" && !isClose) {
      setDepositModal(DEPOSIT_MODAL.OPEN_OPTIONS);
    }
  }, [status, setDepositModal]);

  const handleOpenChange = (value: boolean) => {
    // Prevent closing when Reown modal is open
    if (!address && isForm) {
      return;
    }
    setDepositModal(value ? DEPOSIT_MODAL.OPEN_OPTIONS : DEPOSIT_MODAL.CLOSE);
  };

  return (
    <Dialog
      open={!isClose}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
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
      </DialogTrigger>
      <DialogContent
        className={cn(
          "p-6 md:p-8",
          isBuyCrypto ? "w-[470px] h-[80vh]  md:h-[85vh]" : "md:max-w-md"
        )}
      >
        <Animated.View style={dialogAnimatedStyle} className="overflow-hidden">
          <View
            className={cn(
              "gap-8",
              !isFormAndAddress && !isBuyCrypto && !isTransactionStatus && "min-h-[40rem]"
            )}
            onLayout={(event) => {
              dialogHeight.value = event.nativeEvent.layout.height;
            }}
          >
            <DialogHeader className="flex-row justify-between items-center gap-2">
              {(isFormAndAddress || isBuyCrypto) && (
                <Button
                  variant="ghost"
                  className="rounded-full p-0 web:hover:bg-transparent web:hover:opacity-70"
                  onPress={() => setDepositModal(DEPOSIT_MODAL.OPEN_OPTIONS)}
                >
                  <ArrowLeft color="white" size={20} />
                </Button>
              )}
              {!isTransactionStatus && (
                <Animated.View
                  layout={LinearTransition.duration(ANIMATION_DURATION)}
                >
                  <DialogTitle className="text-2xl">Deposit</DialogTitle>
                </Animated.View>
              )}
              {(isFormAndAddress || isBuyCrypto) && <View className="w-10" />}
            </DialogHeader>
            {isTransactionStatus ? (
              <Animated.View
                entering={isForward ? FadeInRight.duration(ANIMATION_DURATION) : FadeInLeft.duration(ANIMATION_DURATION)}
                exiting={isForward ? FadeOutLeft.duration(ANIMATION_DURATION) : FadeOutRight.duration(ANIMATION_DURATION)}
                key="transaction-status"
              >
                <TransactionStatus
                  amount={transaction.amount ?? 0}
                  hash={transaction.hash ?? "0x"}
                  onPress={() => setDepositModal(DEPOSIT_MODAL.CLOSE)}
                />
              </Animated.View>
            ) : isFormAndAddress ? (
              <Animated.View
                entering={isForward ? FadeInRight.duration(ANIMATION_DURATION) : FadeInLeft.duration(ANIMATION_DURATION)}
                exiting={isForward ? FadeOutLeft.duration(ANIMATION_DURATION) : FadeOutRight.duration(ANIMATION_DURATION)}
                key="deposit-form"
              >
                <DepositToVaultForm />
              </Animated.View>
            ) : isBuyCrypto ? (
              <Animated.View
                entering={
                  shouldAnimate
                    ? (isForward ? FadeInRight.duration(ANIMATION_DURATION) : FadeInLeft.duration(ANIMATION_DURATION))
                    : undefined
                }
                exiting={isForward ? FadeOutLeft.duration(ANIMATION_DURATION) : FadeOutRight.duration(ANIMATION_DURATION)}
                key="buy-crypto"
              >
                <BuyCrypto />
              </Animated.View>
            ) : (
              <Animated.View
                entering={
                  shouldAnimate
                    ? (isForward ? FadeInRight.duration(ANIMATION_DURATION) : FadeInLeft.duration(ANIMATION_DURATION))
                    : undefined
                }
                exiting={isForward ? FadeOutLeft.duration(ANIMATION_DURATION) : FadeOutRight.duration(ANIMATION_DURATION)}
                key="deposit-options"
              >
                <DepositOptions />
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </DialogContent>
    </Dialog>
  );
};

export default DepositOptionModal;
