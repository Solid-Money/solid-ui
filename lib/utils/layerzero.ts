import axios from 'axios';

export interface LayerzeroTransactionResponse {
  data: {
    status: {
      name: string;
      message: string;
    };
    destination?: {
      tx?: {
        txHash: string;
      };
    };
  }[];
}

export const getLayerZeroTransaction = async (
  txHash: string,
): Promise<LayerzeroTransactionResponse> => {
  const response = await axios.get<LayerzeroTransactionResponse>(
    `https://scan.layerzero-api.com/v1/messages/tx/${txHash}`,
  );
  return response.data;
};

export const waitForLayerzeroTransaction = async (
  txHash: string,
  maxRetries = 3,
  maxPolls = 30,
): Promise<LayerzeroTransactionResponse> => {
  return new Promise((resolve, reject) => {
    const pollInterval = 20000; // 20 seconds in milliseconds
    let totalPolls = 0;

    const poll = async (retryCount = 0): Promise<void> => {
      totalPolls++;
      if (totalPolls > maxPolls) {
        reject(new Error('Bridge timeout: transaction took too long to confirm'));
        return;
      }

      try {
        const data = await getLayerZeroTransaction(txHash);

        // Check if any transaction has DELIVERED status
        const isDelivered = data.data?.some(
          transaction => transaction.status?.name === 'DELIVERED',
        );

        const inFlight = data.data?.some(
          transaction =>
            transaction.status?.name === 'INFLIGHT' || transaction.status?.name === 'CONFIRMING',
        );

        // Treat empty data (not yet indexed) as in-flight
        const notYetIndexed = !data.data || data.data.length === 0;

        if (inFlight || notYetIndexed) {
          setTimeout(() => {
            void poll(retryCount);
          }, pollInterval);
        } else if (isDelivered) {
          resolve(data);
        } else {
          reject(new Error('Transaction Error'));
        }
      } catch (error) {
        if (retryCount < maxRetries) {
          setTimeout(() => {
            void poll(retryCount + 1);
          }, pollInterval);
        } else {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    // Start polling
    setTimeout(() => {
      void poll();
    }, pollInterval);
  });
};
