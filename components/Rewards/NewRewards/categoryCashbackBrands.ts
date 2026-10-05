import type { CashbackCategoryKey } from './categoryCashback';
import type { ImageSource } from 'expo-image';

interface BrandLayer {
  source: ImageSource;
  width: number;
  height: number;
  left: number;
  top: number;
  flipY?: boolean;
}

export interface CategoryCashbackBrand {
  name: string;
  background?: { color: string; size?: number; left?: number; top?: number; radius?: number };
  layers: BrandLayer[];
  ring?: 'rides' | 'airlines';
  badgeText?: string;
}

/** New merchant marks fit the same circular slots as the original artwork. */
const logoBrand = (
  name: string,
  source: ImageSource,
  ring?: CategoryCashbackBrand['ring'],
): CategoryCashbackBrand => ({
  name,
  background: { color: '#FFFFFF' },
  layers: [{ source, width: 22, height: 22, left: 4, top: 4 }],
  ...(ring ? { ring } : {}),
});

// Positions and intrinsic SVG dimensions are the 30px merchant slots exported
// from Figma 27572:3100, including the ring and transformed logo layers.
export const CATEGORY_CASHBACK_BRANDS: Record<CashbackCategoryKey, CategoryCashbackBrand[]> = {
  ai: [
    {
      name: 'OpenAI',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/openai.svg'),
          width: 30,
          height: 30,
          left: 0,
          top: 0,
        },
      ],
    },
    {
      name: 'Claude',
      background: { color: '#D97757', left: 1 },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/claude.svg'),
          width: 20.4545,
          height: 20.4545,
          left: 6,
          top: 5,
        },
      ],
    },
    {
      name: 'Gemini',
      background: { color: '#FFFFFF' },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/gemini.svg'),
          width: 24.5455,
          height: 24.5455,
          left: 2.73,
          top: 2.73,
        },
      ],
    },
    logoBrand('Cursor', require('@/assets/images/subscription-cashback/cursor.svg')),
  ],
  streaming: [
    {
      name: 'Netflix',
      background: { color: '#000000' },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/netflix.svg'),
          width: 10.9091,
          height: 20.4545,
          left: 9.55,
          top: 4.09,
        },
      ],
    },
    {
      name: 'Disney+',
      background: { color: '#FFFFFF', size: 29, left: 1 },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/disney.svg'),
          width: 21.0909,
          height: 21.0909,
          left: 4.95,
          top: 3.95,
        },
        {
          source: require('@/assets/images/subscription-cashback/disney-plus.svg'),
          width: 18.7843,
          height: 18.7842,
          left: 6.76,
          top: 5.76,
        },
      ],
    },
    {
      name: 'HBO Max',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/hbo.svg'),
          width: 29,
          height: 29,
          left: 1,
          top: 0,
        },
      ],
    },
    {
      name: 'Prime Video',
      background: { color: '#FFFFFF', size: 28, left: 1, top: 1 },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/amazon.svg'),
          width: 17.805,
          height: 17.8111,
          left: 6.11,
          top: 6.09,
        },
      ],
    },
    {
      name: 'Apple TV',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/apple-tv.svg'),
          width: 28,
          height: 28,
          left: 1,
          top: 1,
        },
      ],
    },
  ],
  music: [
    {
      name: 'Spotify',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/spotify.svg'),
          width: 30,
          height: 30,
          left: 0,
          top: 0,
        },
      ],
    },
    {
      name: 'Apple Music',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/apple-music.svg'),
          width: 30,
          height: 30,
          left: 0,
          top: 0,
        },
      ],
    },
    {
      name: 'YouTube Music',
      background: { color: '#FFFFFF' },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/youtube.svg'),
          width: 21.8182,
          height: 15.2727,
          left: 4.09,
          top: 7.36,
        },
      ],
    },
    logoBrand('YouTube Premium', require('@/assets/images/subscription-cashback/youtube.svg')),
    logoBrand('Deezer', require('@/assets/images/subscription-cashback/deezer.svg')),
  ],
  gaming: [
    logoBrand('Xbox Game Pass', require('@/assets/images/subscription-cashback/xbox.png')),
    logoBrand('PlayStation Plus', require('@/assets/images/subscription-cashback/playstation.svg')),
    logoBrand(
      'Nintendo Switch Online',
      require('@/assets/images/subscription-cashback/nintendo.png'),
    ),
  ],
  rides: [
    {
      name: 'Uber',
      background: { color: '#000000', radius: 13 },
      ring: 'rides',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/uber.svg'),
          width: 16.1538,
          height: 5.45728,
          left: 6.92,
          top: 12.28,
        },
      ],
    },
    {
      name: 'Grab',
      background: { color: '#00B14F', radius: 13 },
      ring: 'rides',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/grab.svg'),
          width: 15.055,
          height: 5.79629,
          left: 6.64,
          top: 12.26,
          flipY: true,
        },
      ],
    },
    {
      name: 'Bolt',
      background: { color: '#2B9C64', radius: 13 },
      ring: 'rides',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/bolt.svg'),
          width: 15.563,
          height: 9.05635,
          left: 7.21,
          top: 10.47,
        },
      ],
    },
    {
      name: 'Gojek',
      background: { color: '#FFFFFF' },
      ring: 'rides',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/gojek.svg'),
          width: 20.7369,
          height: 20.8027,
          left: 4.62,
          top: 4.62,
        },
      ],
    },
    logoBrand('Lyft', require('@/assets/images/subscription-cashback/lyft.svg'), 'rides'),
    logoBrand('Free Now', require('@/assets/images/subscription-cashback/freenow.svg'), 'rides'),
    logoBrand('Cabify', require('@/assets/images/subscription-cashback/cabify.png'), 'rides'),
    logoBrand('Ola Cabs', require('@/assets/images/subscription-cashback/ola.svg'), 'rides'),
  ],
  airlines: [
    {
      name: 'Emirates',
      background: { color: '#D72027', radius: 13 },
      ring: 'airlines',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/emirates.svg'),
          width: 19.0385,
          height: 15.691,
          left: 5.48,
          top: 7.15,
        },
      ],
    },
    {
      name: 'Turkish Airlines',
      background: { color: '#FFFFFF', radius: 13 },
      ring: 'airlines',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/turkish.svg'),
          width: 25.3848,
          height: 25.3848,
          left: 2.31,
          top: 2.31,
          flipY: true,
        },
      ],
    },
    {
      name: 'Singapore Airlines',
      background: { color: '#FFFFFF', radius: 13 },
      ring: 'airlines',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/singapore.svg'),
          width: 12.5075,
          height: 17.3458,
          left: 8.76,
          top: 6.35,
        },
      ],
    },
    {
      name: 'Qatar Airways',
      background: { color: '#56002D' },
      ring: 'airlines',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/qatar.svg'),
          width: 24.2308,
          height: 23.6865,
          left: 5.77,
          top: 1.15,
          flipY: true,
        },
      ],
    },
    logoBrand('Ryanair', require('@/assets/images/subscription-cashback/ryanair.svg'), 'airlines'),
    logoBrand('easyJet', require('@/assets/images/subscription-cashback/easyjet.svg'), 'airlines'),
    logoBrand('Wizz Air', require('@/assets/images/subscription-cashback/wizzair.svg'), 'airlines'),
    logoBrand(
      'Lufthansa',
      require('@/assets/images/subscription-cashback/lufthansa.svg'),
      'airlines',
    ),
    logoBrand(
      'British Airways',
      require('@/assets/images/subscription-cashback/britishairways.svg'),
      'airlines',
    ),
    logoBrand(
      'Air France',
      require('@/assets/images/subscription-cashback/airfrance.svg'),
      'airlines',
    ),
    logoBrand(
      'KLM Royal Dutch',
      require('@/assets/images/subscription-cashback/klm.svg'),
      'airlines',
    ),
    logoBrand(
      'Delta Air Lines',
      require('@/assets/images/subscription-cashback/delta.svg'),
      'airlines',
    ),
    logoBrand(
      'United Airlines',
      require('@/assets/images/subscription-cashback/unitedairlines.svg'),
      'airlines',
    ),
    logoBrand(
      'American Airlines',
      require('@/assets/images/subscription-cashback/americanairlines.svg'),
      'airlines',
    ),
  ],
};
