import { Address } from "viem";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  Send,
  SendTitle,
  SendTrigger
} from "."
import { TokenIcon } from "@/lib/types";

type SendModalProps = {
  tokenAddress: Address;
  tokenDecimals: number;
  tokenIcon: TokenIcon;
  tokenSymbol: string;
  chainId: number;
}

const SendModal = ({
  tokenAddress,
  tokenDecimals,
  tokenIcon,
  tokenSymbol,
  chainId,
}: SendModalProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <SendTrigger />
      </DialogTrigger>
      <DialogContent className="md:p-8 md:gap-8 md:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            <SendTitle />
          </DialogTitle>
        </DialogHeader>
        <Send
          tokenAddress={tokenAddress}
          tokenDecimals={tokenDecimals}
          chainId={chainId}
          tokenIcon={tokenIcon}
          tokenSymbol={tokenSymbol}
        />
      </DialogContent>
    </Dialog>
  )
}

export default SendModal
