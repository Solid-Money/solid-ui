/**
 * Human readable merchant category from an ISO 18245 merchant category code (MCC).
 * Exact codes win over the broader ranges below them.
 */
const EXACT_CATEGORIES: Record<string, string> = {
  '4111': 'Transport',
  '4121': 'Taxi & Rideshare',
  '4131': 'Transport',
  '4511': 'Airlines',
  '4722': 'Travel',
  '4784': 'Tolls',
  '4812': 'Telecom',
  '4814': 'Telecom',
  '4816': 'Digital Services',
  '4899': 'Streaming',
  '4900': 'Utilities',
  '5411': 'Groceries',
  '5412': 'Groceries',
  '5422': 'Groceries',
  '5441': 'Groceries',
  '5451': 'Groceries',
  '5462': 'Bakery',
  '5499': 'Groceries',
  '5541': 'Fuel',
  '5542': 'Fuel',
  '5812': 'Restaurant',
  '5813': 'Bars & Nightlife',
  '5814': 'Fast Food',
  '5912': 'Pharmacy',
  '5921': 'Alcohol',
  '5941': 'Sports',
  '5942': 'Books',
  '5967': 'Digital Services',
  '5968': 'Subscriptions',
  '5969': 'Digital Services',
  '6011': 'Cash Withdrawal',
  '6012': 'Financial Services',
  '6051': 'Financial Services',
  '6300': 'Insurance',
  '7011': 'Hotels',
  '7230': 'Beauty',
  '7298': 'Health & Beauty',
  '7372': 'Software',
  '7392': 'Professional Services',
  '7995': 'Gambling',
  '8011': 'Healthcare',
  '8021': 'Healthcare',
  '8062': 'Healthcare',
  '8099': 'Healthcare',
  '8398': 'Charity',
  '8931': 'Professional Services',
  '9311': 'Tax Payments',
  '9399': 'Government Services',
};

const CATEGORY_RANGES: { from: number; to: number; label: string }[] = [
  { from: 700, to: 999, label: 'Agriculture' },
  { from: 1500, to: 2999, label: 'Contractors' },
  { from: 3000, to: 3299, label: 'Airlines' },
  { from: 3300, to: 3499, label: 'Car Rental' },
  { from: 3500, to: 3999, label: 'Hotels' },
  { from: 4000, to: 4799, label: 'Transport' },
  { from: 4800, to: 4999, label: 'Utilities' },
  { from: 5000, to: 5199, label: 'Wholesale' },
  { from: 5200, to: 5399, label: 'Retail' },
  { from: 5400, to: 5499, label: 'Groceries' },
  { from: 5500, to: 5599, label: 'Automotive' },
  { from: 5600, to: 5699, label: 'Clothing' },
  { from: 5700, to: 5799, label: 'Home & Furniture' },
  { from: 5800, to: 5899, label: 'Restaurant' },
  { from: 5900, to: 5999, label: 'Retail' },
  { from: 6000, to: 6999, label: 'Financial Services' },
  { from: 7000, to: 7299, label: 'Personal Services' },
  { from: 7300, to: 7699, label: 'Business Services' },
  { from: 7800, to: 7999, label: 'Entertainment' },
  { from: 8000, to: 8099, label: 'Healthcare' },
  { from: 8200, to: 8299, label: 'Education' },
  { from: 8300, to: 8999, label: 'Professional Services' },
  { from: 9000, to: 9999, label: 'Government Services' },
];

export const getMerchantCategory = (merchantCategoryCode?: string | null): string | undefined => {
  const code = merchantCategoryCode?.trim();
  if (!code) return undefined;

  if (EXACT_CATEGORIES[code]) return EXACT_CATEGORIES[code];

  const numericCode = Number(code);
  if (!Number.isFinite(numericCode)) return undefined;

  return CATEGORY_RANGES.find(range => numericCode >= range.from && numericCode <= range.to)?.label;
};
