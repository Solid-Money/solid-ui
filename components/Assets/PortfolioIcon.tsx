import { View } from 'react-native';
import { Image } from 'expo-image';

import RenderTokenIcon from '@/components/RenderTokenIcon';
import getTokenIcon from '@/lib/getTokenIcon';
import { TokenBalance } from '@/lib/types';

export const PORTFOLIO_ICONS = {
  usd: require('@/assets/images/portfolio/usd.svg'),
  eth: require('@/assets/images/portfolio/eth.svg'),
  fuse: require('@/assets/images/portfolio/fuse.svg'),
  usdc: require('@/assets/images/portfolio/usdc.svg'),
  lock: require('@/assets/images/portfolio/lock.svg'),
  back: require('@/assets/images/portfolio/back.svg'),
  eye: require('@/assets/images/portfolio/eye.svg'),
  down: require('@/assets/images/portfolio/down.svg'),
  card: require('@/assets/images/portfolio/card.svg'),
};

export type PortfolioIconKind = 'usd' | 'eth' | 'fuse' | 'usdc' | 'card';

export default function PortfolioIcon({
  kind,
  locked = false,
  token,
  symbol,
}: {
  kind?: PortfolioIconKind;
  locked?: boolean;
  /** The token's own logo (its logoUrl, else the app's mark for its symbol). */
  token?: TokenBalance;
  /** A logo by symbol alone, for holdings with no wallet token (escrowed shares, the lock). */
  symbol?: string;
}) {
  return (
    <View style={{ width: 40.7692, height: 40 }}>
      {kind === 'usd' || kind === 'card' ? (
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 40.7692,
            height: 40,
            backgroundColor: kind === 'usd' ? 'rgba(255,255,255,0.1)' : '#333',
          }}
        >
          <Image
            source={PORTFOLIO_ICONS[kind]}
            contentFit="contain"
            style={kind === 'usd' ? { width: 12.1184, height: 23.9253 } : { width: 20, height: 20 }}
          />
        </View>
      ) : kind ? (
        <Image
          source={PORTFOLIO_ICONS[kind]}
          contentFit="contain"
          style={{ width: kind === 'usdc' ? 40 : 40.7692, height: 40 }}
        />
      ) : token || symbol ? (
        <RenderTokenIcon
          tokenIcon={getTokenIcon({
            logoUrl: token?.logoUrl,
            tokenSymbol: token?.contractTickerSymbol ?? symbol,
            size: 40,
          })}
          size={40}
        />
      ) : null}
      {locked && (
        <View
          className="absolute items-center justify-center rounded-full bg-background"
          style={{ left: 25, top: 25, width: 18, height: 18 }}
        >
          <Image
            source={PORTFOLIO_ICONS.lock}
            style={{ width: 10, height: 10 }}
            contentFit="contain"
          />
        </View>
      )}
    </View>
  );
}
