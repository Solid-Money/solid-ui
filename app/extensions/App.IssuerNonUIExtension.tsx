/**
 * Issuer Non-UI Extension: provides list of payment passes to Apple Wallet.
 * Reads session from App Group, fetches extension-cards from backend, builds pass entries
 * via initializeOemTokenization. Requires: react-native-default-preference, getExtensionCards API.
 */
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';

import type { IssuerExtensionPaymentPassEntry } from '@meawallet/react-native-mpp';

const APP_GROUP_NAME = 'group.app.solid.xyz';

export default function IssuerNonUIExtension() {
  const handlerRef = useRef<unknown>(null);

  useEffect(() => {
    void (async () => {
      const mpp = await import('@meawallet/react-native-mpp');
      const MeaPushProvisioning = mpp.default;
      const MppCardDataParameters = mpp.MppCardDataParameters;
      const { IssuerExtensionHandler } = mpp;
      const pref = await import('react-native-default-preference');
      const GroupPreference = pref.default;
      const api = await import('@/lib/api');
      const { getExtensionCards } = api;

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
          // eslint-disable-next-line react/no-this-in-sfc -- this is inside a class, not the SFC
          return this.getPassEntries(false);
        }

        async remotePassEntries() {
          // eslint-disable-next-line react/no-this-in-sfc -- this is inside a class, not the SFC
          return this.getPassEntries(true);
        }

        async getPassEntries(isRemote: boolean): Promise<IssuerExtensionPaymentPassEntry[]> {
          const sessionJson = await GroupPreference.get('session');
          const session = sessionJson ? JSON.parse(sessionJson) : null;
          const token = session?.token;
          if (!token) return [];

          const { cards } = await getExtensionCards(token);
          const entries: IssuerExtensionPaymentPassEntry[] = [];

          const applePay = MeaPushProvisioning.ApplePay as unknown as {
            secureElementPassExistsWithPrimaryAccountNumberSuffix(suffix: string): Promise<boolean>;
            remoteSecureElementPassExistsWithPrimaryAccountNumberSuffix(
              suffix: string,
            ): Promise<boolean>;
          };
          for (const card of cards) {
            const exists = await (isRemote
              ? applePay.remoteSecureElementPassExistsWithPrimaryAccountNumberSuffix(card.lastFour)
              : applePay.secureElementPassExistsWithPrimaryAccountNumberSuffix(card.lastFour));
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
            } as IssuerExtensionPaymentPassEntry);
          }

          return entries;
        }
      }

      handlerRef.current = new Handler();
      const applePayRegister = MeaPushProvisioning.ApplePay as unknown as {
        registerIssuerExtensionHandler?(h: unknown): void;
      };
      if (typeof applePayRegister.registerIssuerExtensionHandler === 'function') {
        applePayRegister.registerIssuerExtensionHandler(handlerRef.current);
      }
    })();
  }, []);

  return <View />;
}
