import { useCallback, useMemo } from 'react';
import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import { router, usePathname } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { DEPOSIT_MODAL } from '@/constants/modals';
import { fetchPromotionsBanner } from '@/lib/api';
import { filterPromotionsBanners } from '@/lib/utils/promotionsBanner';
import { useDepositStore } from '@/store/useDepositStore';
import { useSavingStore } from '@/store/useSavingStore';

import type { PromotionsBannerItem } from '@/lib/types';
import type { PromotionsBannerPlatformKey } from '@/lib/utils/promotionsBanner';

export const PROMOTIONS_BANNER_QUERY_KEY = 'promotions-banner';

export const PROMOTIONS_BANNER_PLATFORM: PromotionsBannerPlatformKey =
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

/**
 * Enabled promotion banners the admin dashboard has targeted at this platform,
 * this app version and the page currently on screen — already in the order the
 * admin sorted them.
 *
 * `nativeApplicationVersion` is the version from app.config.ts that Expo baked
 * into the installed build, which is what the dashboard's version gate is
 * written against.
 */
export const usePromotionsBanners = ({ enabled = true }: { enabled?: boolean } = {}) => {
  const pathname = usePathname();

  const { data, isLoading } = useQuery({
    queryKey: [PROMOTIONS_BANNER_QUERY_KEY],
    queryFn: fetchPromotionsBanner,
    staleTime: 5 * 60 * 1000,
    enabled,
  });

  const banners: PromotionsBannerItem[] = useMemo(
    () =>
      filterPromotionsBanners(data, {
        platform: PROMOTIONS_BANNER_PLATFORM,
        appVersion: Application.nativeApplicationVersion,
        pathname,
      }),
    [data, pathname],
  );

  return { banners, isLoading };
};

type PressablePromotionsBanner = Pick<PromotionsBannerItem, 'link' | 'slug'>;

/**
 * Builds a banner's press handler. An admin-set link wins — external URLs open
 * in the browser and anything else routes in-app — and a couple of banners
 * predating the link field are still matched by slug.
 */
export const usePromotionsBannerPress = () => {
  const setModal = useDepositStore(state => state.setModal);

  return useCallback(
    (item: PressablePromotionsBanner): (() => void) => {
      if (item.link?.trim()) {
        const link = item.link.trim();
        if (link.startsWith('http://') || link.startsWith('https://')) {
          return () => Linking.openURL(link);
        }
        return () => router.push(link as any);
      }

      switch (item.slug) {
        case 'deposit-from-your-bank-or-debit-card':
          return () => {
            useSavingStore.getState().selectVaultForDeposit(0);
            setModal(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_OPTIONS);
          };
        default:
          return () => {};
      }
    },
    [setModal],
  );
};
