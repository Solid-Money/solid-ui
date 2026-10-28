import DefaultTokenIcon from '@/components/DefaultTokenIcon';
import { G_DOLLAR_LOGO_URI } from '@/constants/gooddollar';
import { WALLET_DEPOSIT_TOKENS } from '@/constants/walletDepositTokens';

import { AssetPath, getAsset } from './assets';
import { TokenIcon } from './types';

type GetTokenIconProps = {
  logoUrl?: string;
  tokenSymbol?: string;
  size?: number;
};

/**
 * Share tokens draw their own shape with see-through edges (the dot sits on the circle's
 * edge), hence `bare`: no placeholder fill or round clip in RenderTokenIcon.
 */
const SHARE_ICONS: Record<string, AssetPath> = {
  SOUSD: 'images/sousd-4x.png',
  SOETH: 'images/soeth-4x.png',
  SOFUSE: 'images/sofuse-4x.png',
  // EUR Yield's share: its on-chain symbol is SOEUR, the app's name for it soEURC.
  SOEUR: 'images/soeur-4x.png',
  SOEURC: 'images/soeur-4x.png',
};

const getTokenIcon = ({ logoUrl, tokenSymbol, size = 24 }: GetTokenIconProps): TokenIcon => {
  // soUSD, soETH, soFUSE and soEUR have canonical in-app marks: their product's mark with the
  // green live dot (Figma 28445:4885). External token metadata can return older logos, so
  // resolve them before the generic logoUrl override.
  const shareIcon = SHARE_ICONS[tokenSymbol?.toUpperCase() ?? ''];
  if (shareIcon) return { type: 'image', source: getAsset(shareIcon), bare: true };

  if (logoUrl) {
    return { type: 'image', source: { uri: logoUrl } };
  }

  // Fallback to default token icons based on symbol
  switch (tokenSymbol?.toUpperCase()) {
    case 'USDC':
    // Bridged USDC variants (e.g. USDC.e on Fuse/Arbitrum, used by the
    // borrow-and-deposit-to-card flow) share the USDC icon. Without this the
    // detail page fell back to the "U" placeholder.
    case 'USDC.E':
      return {
        type: 'image',
        source: getAsset('images/usdc-4x.png'),
      };
    case 'USDT':
      return {
        type: 'image',
        source: getAsset('images/usdt.png'),
      };
    case 'EURC':
      return {
        type: 'image',
        source: getAsset('images/eurc.png'),
      };
    case 'WETH':
    case 'ETH':
      return {
        type: 'image',
        source: getAsset('images/eth.png'),
      };
    case 'FUSE':
    case 'WFUSE':
      return {
        type: 'image',
        source: getAsset('images/wfuse.png'),
      };
    // Coinbase's wrapped ZEC, a Base collateral; the deposit list carries the mark as ZEC.
    case 'CBZEC':
      return {
        type: 'image',
        source: getAsset('images/zec.png'),
      };
    case 'G$':
      return {
        type: 'image',
        source: { uri: G_DOLLAR_LOGO_URI },
      };
    default: {
      // The rest of what the deposit screen takes (PAXG, WBTC, SOL, ...), with
      // the marks it draws them with, so a deposit looks the same once it lands.
      const depositToken = WALLET_DEPOSIT_TOKENS.find(
        token => token.symbol.toUpperCase() === tokenSymbol?.toUpperCase(),
      );
      if (depositToken) return { type: 'image', source: getAsset(depositToken.icon) };

      return {
        type: 'component',
        component: <DefaultTokenIcon size={size} symbol={tokenSymbol || 'T'} />,
      };
    }
  }
};

export default getTokenIcon;
