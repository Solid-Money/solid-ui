import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  Unstake,
  UnstakeTitle,
  UnstakeTrigger
} from "."

const UnstakeModal = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <UnstakeTrigger />
      </DialogTrigger>
      <DialogContent className="md:p-8 md:gap-8 md:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            <UnstakeTitle />
          </DialogTitle>
        </DialogHeader>
        <Unstake />
      </DialogContent>
    </Dialog>
  )
}

export default UnstakeModal
