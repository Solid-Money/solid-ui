/**
 * Issuer Non-UI Extension: provides list of payment passes to Apple Wallet.
 * Reads session from App Group, fetches extension-cards from backend, builds pass entries
 * via initializeOemTokenization. Requires: react-native-default-preference, getExtensionCards API.
 */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

const APP_GROUP_NAME = 'group.app.solid.xyz';

export default function IssuerNonUIExtension() {
  const handlerRef = useRef<unknown>(null);

  useEffect(() => {
    const MeaPushProvisioning = require('@meawallet/react-native-mpp').default;
    const MppCardDataParameters = require('@meawallet/react-native-mpp').MppCardDataParameters;
    const { IssuerExtensionHandler } = require('@meawallet/react-native-mpp');
    const GroupPreference = require('react-native-default-preference').default;
    const { getExtensionCards } = require('@/lib/api');

    GroupPreference.setName(APP_GROUP_NAME);

    class Handler extends IssuerExtensionHandler {
      async status() {
        return {
          requiresAuthentication: true,
          passEntriesAvailable: true,
          remotePassEntriesAvailable: true,
        };
      }

      async passEntries() {
        return this.getPassEntries(false);
      }

      async remotePassEntries() {
        return this.getPassEntries(true);
      }

      async getPassEntries(isRemote: boolean): Promise<unknown[]> {
        const sessionJson = await GroupPreference.get('session');
        const session = sessionJson ? JSON.parse(sessionJson) : null;
        const token = session?.token;
        if (!token) return [];

        const { cards } = await getExtensionCards(token);
        const entries: unknown[] = [];

        for (const card of cards) {
          const exists = await (isRemote
            ? MeaPushProvisioning.ApplePay.remoteSecureElementPassExistsWithPrimaryAccountNumberSuffix(
                card.lastFour,
              )
            : MeaPushProvisioning.ApplePay.secureElementPassExistsWithPrimaryAccountNumberSuffix(
                card.lastFour,
              ));
          if (exists) continue;

          const cardParams = MppCardDataParameters.withCardSecret(card.cardId, card.cardSecret);
          const tokenizationData =
            await MeaPushProvisioning.ApplePay.initializeOemTokenization(cardParams);

          const addRequestConfiguration = {
            style: 'payment',
            cardholderName: tokenizationData.cardholderName,
            primaryAccountSuffix: tokenizationData.primaryAccountNumberSuffix,
            cardDetails: [],
            primaryAccountIdentifier: tokenizationData.primaryAccountIdentifier,
            paymentNetwork: tokenizationData.networkName,
            productIdentifiers: [],
            requiresFelicaSecureElement: false,
          };

          entries.push({
            identifier: tokenizationData.tokenizationReceipt,
            title: tokenizationData.cardholderName,
            art: card.artUrl ?? '',
            addRequestConfiguration,
          });
        }

        return entries;
      }
    }

    handlerRef.current = new Handler();
    // If the SDK requires registering the handler with native side, do it here.
    if (
      typeof (
        MeaPushProvisioning.ApplePay as { registerIssuerExtensionHandler?: (h: unknown) => void }
      ).registerIssuerExtensionHandler === 'function'
    ) {
      (
        MeaPushProvisioning.ApplePay as { registerIssuerExtensionHandler: (h: unknown) => void }
      ).registerIssuerExtensionHandler(handlerRef.current);
    }
  }, []);

  return <View />;
}
