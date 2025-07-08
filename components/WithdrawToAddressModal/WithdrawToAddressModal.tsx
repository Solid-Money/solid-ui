import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  WithdrawTitle,
  WithdrawToAddress,
  WithdrawTrigger
} from "."

const WithdrawToAddressModal = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <WithdrawTrigger />
      </DialogTrigger>
      <DialogContent className="md:p-8 md:gap-8 md:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            <WithdrawTitle />
          </DialogTitle>
        </DialogHeader>
        <WithdrawToAddress />
      </DialogContent>
    </Dialog>
  )
}

export default WithdrawToAddressModal
