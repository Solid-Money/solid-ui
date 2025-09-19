import { checkBridgeStatus } from "@/lib/api";
import { LifiStatus, LifiStatusResponse } from "@/lib/types";
import { oneMinute } from "@/lib/utils/utils";

export const waitForBridgeTransactionReceipt = async (bridgeTxHash: string) => {
  return new Promise<LifiStatusResponse>(async (resolve, reject) => {
    const interval = setInterval(async () => {
      const bridgeStatus = await checkBridgeStatus(bridgeTxHash);

      if (bridgeStatus.status === LifiStatus.FAILED) {
        clearInterval(interval);
        reject("Bridge transaction failed");
      }

      if (bridgeStatus.status === LifiStatus.DONE) {
        clearInterval(interval);
        resolve(bridgeStatus);
      }
    }, oneMinute);
  });
};
