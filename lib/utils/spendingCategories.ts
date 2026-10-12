import type { CardTransaction } from '@/lib/types';

/**
 * Which Insights category a card purchase belongs to.
 *
 * The categories are fixed, so each one keeps its name, icon and colour from
 * one month to the next and across card issuers. A purchase is placed by
 * whichever signal is most trustworthy for it, in this order:
 *
 * 1. Subscription cashback the backend paid, or a known subscription service.
 * 2. A merchant known to be billed under the wrong code: food delivery apps
 *    under taxi codes, so Uber Eats would otherwise read as Transport.
 * 3. A specific merchant category code (MCC). Rain and Bridge send one.
 * 4. A known merchant name (supermarket chains, airlines, exchanges…).
 * 5. The issuer's own category name. Wirex sends "Online Shopping" instead of
 *    an MCC.
 * 6. Words in the merchant name ("pizza", "pharmacy", "parking").
 * 7. A catch-all MCC ("misc. retail", "business services").
 *
 * Anything left is Other.
 */

export type SpendingCategoryKey =
  | 'food'
  | 'groceries'
  | 'shopping'
  | 'transport'
  | 'subscriptions'
  | 'entertainment'
  | 'health'
  | 'bills'
  | 'transfers'
  | 'business'
  | 'other';

export interface SpendingCategoryMeta {
  key: SpendingCategoryKey;
  label: string;
  /**
   * Fixed per category, never by rank, so a category keeps its colour from one
   * month to the next. The ring orders slices by amount, so any two of them can
   * end up side by side: the ten hues are chosen so that every pair, not just
   * neighbours, stays apart, for full colour vision (OKLab ΔE ≥ 15) and for
   * protan/deutan colour blindness (ΔE ≥ 8), each at 3:1 or better on the
   * #1C1C1C card. Green is left out: in this app it means cashback. Other is a
   * neutral grey so it recedes. The list beside the chart still names every
   * category and gives it an icon.
   */
  color: string;
}

export const SPENDING_CATEGORIES: Record<SpendingCategoryKey, SpendingCategoryMeta> = {
  food: { key: 'food', label: 'Food & Drink', color: '#DE3E2D' },
  groceries: { key: 'groceries', label: 'Groceries', color: '#06AAC7' },
  shopping: { key: 'shopping', label: 'Shopping', color: '#5471F5' },
  transport: { key: 'transport', label: 'Transport & Travel', color: '#FBC031' },
  subscriptions: { key: 'subscriptions', label: 'Subscriptions', color: '#ACB8FE' },
  entertainment: { key: 'entertainment', label: 'Entertainment', color: '#FF64AD' },
  health: { key: 'health', label: 'Health & Beauty', color: '#FFA9AB' },
  bills: { key: 'bills', label: 'Bills & Services', color: '#A04EA8' },
  transfers: { key: 'transfers', label: 'Cash & Transfers', color: '#39F3F9' },
  business: { key: 'business', label: 'Business', color: '#A6A442' },
  other: { key: 'other', label: 'Other', color: '#6E6E6E' },
};

// ---------------------------------------------------------------------------
// Merchant category codes (ISO 18245)

/** Codes that say more than the range they sit in. */
const MCC_EXACT: Record<string, SpendingCategoryKey> = {
  // Food & drink
  '5462': 'food', // bakeries
  // Groceries
  '5300': 'groceries', // wholesale clubs
  '5921': 'groceries', // liquor stores
  // Subscriptions and digital services
  '4816': 'subscriptions', // computer network / information services
  '4899': 'subscriptions', // cable, satellite and streaming
  '5734': 'subscriptions', // computer software stores (most SaaS and AI tools)
  '5815': 'subscriptions', // digital books, movies, music
  '5817': 'subscriptions', // digital applications
  '5818': 'subscriptions', // large digital goods merchants (App Store, Google Play)
  '5967': 'subscriptions', // inbound teleservices
  '5968': 'subscriptions', // continuity / subscription merchants
  '7273': 'subscriptions', // dating services
  '7372': 'subscriptions', // software, data processing
  '7375': 'subscriptions', // information retrieval services
  // Entertainment
  '5816': 'entertainment', // digital games
  // Health & beauty
  '4119': 'health', // ambulance services
  '5122': 'health', // drugs, wholesale
  '5912': 'health', // pharmacies
  '5975': 'health', // hearing aids
  '5976': 'health', // orthopedic goods
  '5977': 'health', // cosmetic stores
  '7230': 'health', // beauty and barber shops
  '7297': 'health', // massage parlors
  '7298': 'health', // health and beauty spas
  '7997': 'health', // gyms and membership clubs
  // Bills & services
  '5960': 'bills', // direct marketing: insurance
  '5983': 'bills', // fuel dealers (home heating)
  '6513': 'bills', // real estate agents and rentals
  // Cash & transfers
  '4829': 'transfers', // money transfers
  // Transport & travel
  '5172': 'transport', // petroleum products
  '5962': 'transport', // direct marketing: travel
  // Shopping
  '4214': 'shopping', // couriers and delivery
  '4215': 'shopping', // couriers
  '5963': 'shopping', // door-to-door sales
  '5964': 'shopping', // catalog merchants
  '5965': 'shopping', // catalog and retail
  '5969': 'shopping', // other direct marketers
  '9402': 'shopping', // postal services
  // Business
  '5111': 'business', // stationery and office supplies
  '8111': 'business', // legal services
  '8911': 'business', // architectural and engineering services
  '8931': 'business', // accounting and bookkeeping
  '8999': 'business', // professional services
  // Home services within the business-services range
  '7342': 'bills', // pest control
  '7349': 'bills', // cleaning and maintenance
  // Other
  '5966': 'other', // outbound telemarketing
  '8398': 'other', // charities
  '8641': 'other', // civic and social associations
  '8651': 'other', // political organisations
  '8661': 'other', // religious organisations
  '8699': 'other', // membership organisations
};

const MCC_RANGES: { from: number; to: number; category: SpendingCategoryKey }[] = [
  { from: 3000, to: 3999, category: 'transport' }, // airlines, car rental, hotels
  { from: 4000, to: 4799, category: 'transport' },
  { from: 4800, to: 4999, category: 'bills' }, // telecom, utilities
  { from: 5000, to: 5399, category: 'shopping' },
  { from: 5400, to: 5499, category: 'groceries' },
  { from: 5500, to: 5599, category: 'transport' }, // automotive and fuel
  { from: 5600, to: 5799, category: 'shopping' },
  { from: 5800, to: 5899, category: 'food' },
  { from: 5900, to: 5999, category: 'shopping' },
  { from: 6000, to: 6299, category: 'transfers' }, // cash, quasi-cash, crypto, brokers
  { from: 6300, to: 6399, category: 'bills' }, // insurance
  { from: 6400, to: 6999, category: 'transfers' }, // payment services, stored value
  { from: 1500, to: 2999, category: 'bills' }, // contractors, home services
  { from: 7000, to: 7099, category: 'transport' }, // lodging
  { from: 7200, to: 7299, category: 'bills' }, // personal services
  { from: 7300, to: 7399, category: 'business' }, // advertising, business services
  { from: 7500, to: 7599, category: 'transport' }, // car rental, parking, repairs
  { from: 7600, to: 7699, category: 'bills' }, // repair services
  { from: 7800, to: 7999, category: 'entertainment' }, // cinema, events, games, gambling
  { from: 8000, to: 8099, category: 'health' },
  { from: 8100, to: 8999, category: 'bills' }, // education, other services
  { from: 9200, to: 9399, category: 'bills' }, // fines, taxes, government
];

/**
 * Catch-all codes. They are a guess on the issuer's side, so a merchant name or
 * a category name that says something more specific wins over them.
 */
const CATCH_ALL_MCCS = new Set(['5399', '5969', '5999', '7299', '7399', '8999']);

export const getMccCategory = (code?: string | null): SpendingCategoryKey | undefined => {
  const trimmed = code?.trim();
  if (!trimmed || !/^\d{3,4}$/.test(trimmed)) return undefined;
  const normalised = trimmed.padStart(4, '0');
  if (MCC_EXACT[normalised]) return MCC_EXACT[normalised];

  const numeric = Number(normalised);
  return (
    MCC_RANGES.find(range => numeric >= range.from && numeric <= range.to)?.category ?? 'other'
  );
};

// ---------------------------------------------------------------------------
// Merchant names

/**
 * Subscription services recognised by merchant name. Names match
 * `subscriptionBrands.ts`, which holds the logos; categories match the keys the
 * backend bills subscription cashback under.
 *
 * Used to put a charge under Subscriptions and give it a logo — never to
 * promise cashback, which only an actual cashback row shows.
 */
const SUBSCRIPTION_BRANDS: { name: string; category: string; aliases: string[] }[] = [
  { name: 'OpenAI', category: 'ai', aliases: ['openai', 'chatgpt'] },
  { name: 'Claude', category: 'ai', aliases: ['anthropic', 'claude.ai', 'claude'] },
  { name: 'Gemini', category: 'ai', aliases: ['gemini'] },
  { name: 'Netflix', category: 'streaming', aliases: ['netflix'] },
  { name: 'Disney', category: 'streaming', aliases: ['disney'] },
  { name: 'HBO Max', category: 'streaming', aliases: ['hbo max', 'hbomax', 'max.com'] },
  {
    name: 'Amazon Prime',
    category: 'streaming',
    aliases: ['prime video', 'primevideo', 'amazon prime', 'amzn prime'],
  },
  { name: 'Apple TV', category: 'streaming', aliases: ['apple tv', 'appletv'] },
  { name: 'Spotify', category: 'music', aliases: ['spotify'] },
  { name: 'Apple Music', category: 'music', aliases: ['apple music'] },
  {
    name: 'Youtube Music',
    category: 'music',
    aliases: ['youtube music', 'youtube premium', 'youtubepremium'],
  },
];

export type MatchedSubscriptionBrand = { name: string; category: string };

export const matchSubscriptionBrand = (
  merchant: string | undefined | null,
): MatchedSubscriptionBrand | undefined => {
  const haystack = merchant?.toLowerCase();
  if (!haystack) return undefined;
  const brand = SUBSCRIPTION_BRANDS.find(candidate =>
    candidate.aliases.some(alias => haystack.includes(alias)),
  );
  return brand ? { name: brand.name, category: brand.category } : undefined;
};

/**
 * "UBER *EATS PENDING" → " uber eats pending ". Lower case, every run of
 * punctuation a single space, padded so a phrase can be matched on whole words
 * with a plain `includes(' phrase ')`.
 */
const normaliseMerchant = (merchant: string): string =>
  ` ${merchant
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

type NameRule = [SpendingCategoryKey, string[]];

const findNameRule = (rules: NameRule[], normalised: string): SpendingCategoryKey | undefined =>
  rules.find(([, phrases]) => phrases.some(phrase => normalised.includes(` ${phrase} `)))?.[0];

/**
 * Merchants routinely billed under a code that says something else, so they
 * are matched ahead of the MCC. Seen in our own card data (September 2026):
 *
 * - food delivery under taxi or convenience-store codes (Uber Eats would
 *   otherwise read as Transport);
 * - game top-ups and in-app coins under software and digital-app codes, which
 *   would otherwise read as Subscriptions;
 * - marketplaces under grocery codes (Lazada under 5499);
 * - wallet top-ups under insurance codes (Tinaba under 6300);
 * - DiDi under software, Airbnb under real-estate rentals;
 * - ad spend (Facebook, Google, TikTok) billed in the merchant's own name,
 *   matched first so "TikTok Ads" is not read as TikTok coins.
 */
const MISCODED_MERCHANTS: NameRule[] = [
  [
    'business',
    [
      'facebk',
      'facebook ads',
      'meta ads',
      'metapay',
      'google ads',
      'googleads',
      'tiktok ads',
      'linkedin ads',
      'twitter ads',
      'x ads',
      'snapchat ads',
      'reddit ads',
      'microsoft ads',
      'bing ads',
      'upwork',
      'fiverr',
    ],
  ],
  [
    'shopping',
    [
      'tiktok shop',
      'lazada',
      'shopee',
      'tokopedia',
      'taobao',
      'tmall',
      'jingdong',
      'jd com',
      'pinduoduo',
      'panduo',
    ],
  ],
  [
    'food',
    [
      'uber eats',
      'ubereats',
      'bolt food',
      'wolt',
      'glovo',
      'deliveroo',
      'doordash',
      'grubhub',
      'just eat',
      'justeat',
      'foodpanda',
      'talabat',
      'swiggy',
      'zomato',
      'ifood',
      'rappi',
      'postmates',
      'menulog',
      'skipthedishes',
      'skip the dishes',
      '10bis',
      'cibus',
      'mishloha',
      'lieferando',
      'thuisbezorgd',
      'pedidosya',
      'hungerstation',
      'grabfood',
      'gofood',
      'seamless',
      'meituan',
      'eleme',
      'ele me',
      '99food',
    ],
  ],
  [
    'entertainment',
    [
      'tiktok',
      'efootball',
      'pubg',
      'pubgmobile',
      'call of duty',
      'ea sports',
      'brawl stars',
      'supercell',
      'yalla ludo',
      'free fire',
      'garena',
      'mobile legends',
      'moonton',
      'genshin',
      'hoyoverse',
      'roblox',
      'codashop',
      'moogold',
      'offgamers',
      'xsolla',
      'eneba',
      'steam',
      'steampowered',
    ],
  ],
  ['transfers', ['tinaba', 'nequi']],
  ['transport', ['airbnb', 'didi']],
];

/**
 * Other subscription services, without a logo of their own. Matched on whole
 * words, ahead of the MCC, because these bill under shopping and business codes.
 */
const SUBSCRIPTION_SERVICES: NameRule[] = [
  [
    'subscriptions',
    [
      'apple com bill',
      'itunes',
      'icloud',
      'google one',
      'google storage',
      'youtube',
      'dropbox',
      'notion',
      'figma',
      'adobe',
      'microsoft',
      'msft',
      'discord',
      'patreon',
      'canva',
      'duolingo',
      'linkedin',
      'medium com',
      'substack',
      'github',
      'midjourney',
      'cursor',
      'perplexity',
      'grammarly',
      'nordvpn',
      'expressvpn',
      'surfshark',
      'proton',
      '1password',
      'lastpass',
      'audible',
      'kindle',
      'hulu',
      'paramount',
      'peacock',
      'crunchyroll',
      'deezer',
      'tidal',
      'twitch',
      'dazn',
      'tinder',
      'bumble',
      'hinge',
      'headspace',
      'calm com',
      'strava',
      'chess com',
      'telegram premium',
      'zoom us',
      'openrouter',
      'replit',
      'vercel',
      'digitalocean',
      'aws',
      'amazon web services',
      'google cloud',
      'cloudflare',
    ],
  ],
];

/** Well-known merchants whose category is not in doubt. */
const KNOWN_MERCHANTS: NameRule[] = [
  [
    'food',
    [
      'starbucks',
      'mcdonald',
      'mcdonalds',
      'burger king',
      'kfc',
      'dominos',
      'pizza hut',
      'papa johns',
      'taco bell',
      'wendys',
      'chipotle',
      'dunkin',
      'costa coffee',
      'pret a manger',
      'tim hortons',
      'five guys',
      'nandos',
      'shake shack',
      'popeyes',
      'chick fil a',
      'panera',
      'little caesars',
      'krispy kreme',
      'cofix',
      'aroma espresso',
      'greg cafe',
    ],
  ],
  [
    'groceries',
    [
      'instacart',
      'gopuff',
      'getir',
      'flink',
      'ocado',
      'tesco',
      'sainsbury',
      'sainsburys',
      'asda',
      'morrisons',
      'aldi',
      'lidl',
      'carrefour',
      'whole foods',
      'trader joe',
      'trader joes',
      'kroger',
      'safeway',
      'publix',
      'wegmans',
      'costco',
      'shufersal',
      'rami levy',
      'yochananof',
      'osher ad',
      'tiv taam',
      'mercadona',
      'edeka',
      'rewe',
      'albert heijn',
      'spar',
      '7 eleven',
      'seven eleven',
      'familymart',
      'family mart',
      'lawson',
    ],
  ],
  [
    'transfers',
    [
      'binance',
      'coinbase',
      'kraken',
      'bybit',
      'okx',
      'crypto com',
      'revolut',
      'wise com',
      'wise payments',
      'transferwise',
      'western union',
      'moneygram',
      'remitly',
      'skrill',
      'neteller',
      'payoneer',
      'moonpay',
      'bitpanda',
      'bitstamp',
      'cash app',
      'venmo',
      'zelle',
      'etoro',
      'robinhood',
      'trading 212',
      'n26',
      'bunq',
      'aircash',
      'lemfi',
      'dana indonesia',
    ],
  ],
  [
    'bills',
    [
      'vodafone',
      't mobile',
      'verizon',
      'at t',
      'cellcom',
      'pelephone',
      'hot mobile',
      'bezeq',
      'golan telecom',
      'comcast',
      'xfinity',
      'octopus energy',
      'british gas',
    ],
  ],
  [
    'health',
    [
      'super pharm',
      'superpharm',
      'be pharm',
      'boots',
      'cvs',
      'walgreens',
      'rite aid',
      'dm drogerie',
      'sephora',
      'ulta',
      'holmes place',
      'planet fitness',
      'equinox',
      'classpass',
      'fresha',
      'treatwell',
    ],
  ],
  [
    'entertainment',
    [
      'epic games',
      'nintendo',
      'playstation',
      'xbox',
      'riot games',
      'blizzard',
      'ticketmaster',
      'eventbrite',
      'live nation',
      'stubhub',
      'seatgeek',
      'cinema city',
      'yes planet',
      'imax',
      'amc',
      'cinemark',
      'odeon',
      'bet365',
      'pokerstars',
    ],
  ],
  [
    'transport',
    [
      'uber',
      'lyft',
      'bolt',
      'gett',
      'yango',
      'careem',
      'cabify',
      'free now',
      'freenow',
      'blablacar',
      'moovit',
      'pango',
      'cellopark',
      'rav kav',
      'ravkav',
      'tfl',
      'mta',
      'trainline',
      'ryanair',
      'easyjet',
      'wizz air',
      'wizzair',
      'el al',
      'elal',
      'lufthansa',
      'klm',
      'air france',
      'british airways',
      'emirates',
      'turkish airlines',
      'qatar airways',
      'delta air',
      'united airlines',
      'american airlines',
      'southwest',
      'jetblue',
      'booking com',
      'airbnb',
      'expedia',
      'hotels com',
      'agoda',
      'trip com',
      'kiwi com',
      'hertz',
      'avis',
      'sixt',
      'europcar',
      'shell',
      'esso',
      'exxon',
      'chevron',
      'texaco',
      'delek',
      'sonol',
      'dor alon',
      'paz',
      'bp',
    ],
  ],
  [
    'shopping',
    [
      'amazon',
      'amzn',
      'aliexpress',
      'temu',
      'shein',
      'ebay',
      'etsy',
      'zara',
      'uniqlo',
      'ikea',
      'best buy',
      'target',
      'walmart',
      'apple store',
      'asos',
      'zalando',
      'nike',
      'adidas',
      'decathlon',
      'primark',
    ],
  ],
];

/**
 * Words that give a small merchant away ("Sushi Bar", "City Pharmacy"). Less
 * certain than a known name, so they only decide a purchase nothing else could.
 * Health runs before food so a "nail bar" is not a bar.
 */
const NAME_KEYWORDS: NameRule[] = [
  [
    'health',
    [
      'pharmacy',
      'pharm',
      'apotheke',
      'farmacia',
      'pharmacie',
      'drugstore',
      'clinic',
      'medical',
      'dental',
      'dentist',
      'doctor',
      'hospital',
      'optic',
      'optical',
      'optician',
      'salon',
      'barber',
      'barbershop',
      'nail',
      'nails',
      'spa',
      'beauty',
      'cosmetics',
      'gym',
      'fitness',
      'yoga',
      'pilates',
      'physio',
      'massage',
    ],
  ],
  [
    'food',
    [
      'restaurant',
      'restaurante',
      'ristorante',
      'cafe',
      'caffe',
      'coffee',
      'espresso',
      'bakery',
      'boulangerie',
      'patisserie',
      'pizza',
      'pizzeria',
      'sushi',
      'ramen',
      'burger',
      'burgers',
      'grill',
      'bistro',
      'brasserie',
      'trattoria',
      'taqueria',
      'diner',
      'steakhouse',
      'kebab',
      'shawarma',
      'falafel',
      'hummus',
      'noodle',
      'noodles',
      'bbq',
      'tapas',
      'pub',
      'bar',
      'brewery',
      'bagel',
      'bagels',
      'donut',
      'donuts',
      'gelato',
      'ice cream',
      'juice',
      'canteen',
      'cafeteria',
      'deli',
      'eatery',
      'food court',
      'street food',
      'fast food',
    ],
  ],
  [
    'groceries',
    [
      'supermarket',
      'super market',
      'grocery',
      'groceries',
      'minimarket',
      'mini market',
      'market',
      'supermercado',
      'supermarche',
      'epicerie',
      'convenience',
      'butcher',
    ],
  ],
  [
    'transport',
    [
      'parking',
      'taxi',
      'cab',
      'airport',
      'airlines',
      'airways',
      'railway',
      'rail',
      'train',
      'metro',
      'transit',
      'bus',
      'ferry',
      'fuel',
      'petrol',
      'gas station',
      'toll',
      'tolls',
      'hotel',
      'hostel',
      'motel',
      'car rental',
      'rent a car',
      'car wash',
    ],
  ],
  [
    'entertainment',
    [
      'cinema',
      'cinemas',
      'movies',
      'theatre',
      'theater',
      'tickets',
      'concert',
      'museum',
      'zoo',
      'bowling',
      'escape room',
      'casino',
      'arcade',
      'karaoke',
      'games',
      'gaming',
    ],
  ],
  [
    'business',
    ['advertising', 'marketing', 'consulting', 'coworking', 'wework', 'regus', 'accounting'],
  ],
  [
    'bills',
    [
      'electric',
      'electricity',
      'energy',
      'utility',
      'utilities',
      'telecom',
      'mobile',
      'internet',
      'broadband',
      'insurance',
      'municipality',
      'laundry',
      'repair',
      'school',
      'university',
      'tuition',
    ],
  ],
  [
    'transfers',
    [
      'atm',
      'exchange',
      'crypto',
      'bitcoin',
      'remittance',
      'money transfer',
      'top up',
      'topup',
      'ricarica',
      'abono',
    ],
  ],
  [
    'shopping',
    [
      'store',
      'shop',
      'outlet',
      'boutique',
      'mall',
      'marketplace',
      'electronics',
      'fashion',
      'clothing',
      'shoes',
      'furniture',
      'books',
      'toys',
    ],
  ],
];

// ---------------------------------------------------------------------------
// Issuer category names (Wirex)

/**
 * Wirex names the category instead of sending an MCC ("Online Shopping"), in
 * its own vocabulary. Matched by keyword, first rule wins: specific words
 * before the shopping catch-all, so "Beauty shop" is health and "Sporting
 * goods store" is shopping.
 */
const LABEL_KEYWORDS: [RegExp, SpendingCategoryKey][] = [
  [/grocer|supermarket|convenience/i, 'groceries'],
  [/restaurant|food|dining|cafe|café|coffee|\bbars?\b|\bpubs?\b|bakery|takeaway|eating/i, 'food'],
  [/subscription|streaming|digital|software|app store|online service/i, 'subscriptions'],
  [
    /transfer|\bcash\b|\batm\b|withdraw|crypto|currency|exchange|financial|\bbank|money|remittance|top.?up|broker|invest|securities/i,
    'transfers',
  ],
  [/business|advertis|marketing|office|professional/i, 'business'],
  [
    /utilit|telecom|\bphone|internet|cable|electric|energy|insurance|\bbills?\b|\btax|government|\brent\b|\bservices?\b/i,
    'bills',
  ],
  [
    /health|pharma|drug|medical|doctor|dental|hospital|clinic|beauty|cosmetic|salon|barber|\bspa\b|fitness|\bgym|wellness|optic|personal care/i,
    'health',
  ],
  [
    /taxi|\bride|transport|transit|fuel|petrol|gas station|parking|toll|travel|holiday|airline|flight|hotel|car rental|accommodation|lodging|automotive|\bcar\b|vehicle|railway|\btrain/i,
    'transport',
  ],
  [
    /shop|retail|cloth|fashion|apparel|electronic|department|\bstores?\b|marketplace|furniture|\bhome\b|garden|hardware|\bbooks?\b|\btoys?\b|\bpets?\b|jewel|gift|shoes|goods|commerce/i,
    'shopping',
  ],
  [
    /entertain|cinema|movie|theat|concert|\bevents?\b|ticket|\bgam(e|es|ing)\b|leisure|recreation|amusement|gambl|casino|betting|lotter|\bsports?\b/i,
    'entertainment',
  ],
];

const matchLabel = (label: string | undefined): SpendingCategoryKey | undefined => {
  const trimmed = label?.trim();
  if (!trimmed) return undefined;
  return LABEL_KEYWORDS.find(([pattern]) => pattern.test(trimmed))?.[1];
};

// ---------------------------------------------------------------------------

export const merchantOf = (transaction: Pick<CardTransaction, 'merchant_name' | 'description'>) =>
  transaction.merchant_name?.trim() || transaction.description?.trim() || '';

/**
 * Which category a purchase belongs to. See the top of this file for the order
 * the signals are tried in.
 */
export const getSpendingCategory = (
  transaction: Pick<
    CardTransaction,
    'id' | 'merchant_category_code' | 'merchant_category_label' | 'merchant_name' | 'description'
  >,
  subscriptionTransactionIds?: ReadonlySet<string>,
): SpendingCategoryKey => {
  if (subscriptionTransactionIds?.has(transaction.id)) return 'subscriptions';

  const merchant = merchantOf(transaction);
  if (matchSubscriptionBrand(merchant)) return 'subscriptions';

  const name = normaliseMerchant(merchant);
  const priority =
    findNameRule(MISCODED_MERCHANTS, name) ?? findNameRule(SUBSCRIPTION_SERVICES, name);
  if (priority) return priority;

  const code = transaction.merchant_category_code?.trim();
  const fromCode = getMccCategory(code);
  const isCatchAll = !!code && CATCH_ALL_MCCS.has(code.padStart(4, '0'));
  if (fromCode && fromCode !== 'other' && !isCatchAll) return fromCode;

  return (
    findNameRule(KNOWN_MERCHANTS, name) ??
    matchLabel(transaction.merchant_category_label) ??
    findNameRule(NAME_KEYWORDS, name) ??
    fromCode ??
    'other'
  );
};
