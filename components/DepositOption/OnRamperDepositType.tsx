import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import useOnramperClient from '@/hooks/useOnramperClient';
import useUser from '@/hooks/useUser';

const OnRamperDepositType = () => {
  const { client: onramperClient } = useOnramperClient();
  const { user } = useUser();
  const [button, setButton] = useState<React.ReactNode | null>(null);
  const [, setQuote] = useState<any>(null);

  useEffect(() => {
    if (onramperClient && user) {
      onramperClient
        .getCheckoutRequirements({
          source: 'eur',
          destination: 'sol',
          amount: 10,
          type: 'buy',
          paymentMethod: 'applepay',
          country: 'ES',
          wallet: { network: 'solana', address: 'HbUUNJoSr2LTqCDhNzy1BfbsE4hTAV41hiCYhMA5mb2' },
        })
        .then(({ button, quote }) => {
          if (button) {
            setButton(button);
          }
          if (quote) {
            setQuote(quote);
          }
        })
        .catch(error => {
          console.error('Error fetching Onramper checkout requirements:', error);
        });
    }
  }, [onramperClient, user]);

  return <View>{button}</View>;
};

export default OnRamperDepositType;
