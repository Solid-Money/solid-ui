/**
 * Get initials from merchant/person name for avatar display
 */
export const getInitials = (name: string): string => {
  if (!name) return '?';
  const words = name.split(' ');
  if (words.length === 1) return name.substring(0, 2).toUpperCase();
  return (words[0][0] + (words[1]?.[0] || '')).toUpperCase();
};

/**
 * Get a consistent avatar color based on name hash
 */
export const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-[#5B7C8D]', // teal/blue
    'bg-[#8B5A5A]', // red/brown
    'bg-[#6B5B8B]', // purple
    'bg-[#8B7A5A]', // brown/tan
    'bg-[#5A8B6B]', // green
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

/**
 * Format card transaction amount with proper sign and currency symbol
 */
export const formatCardAmount = (amount: string): string => {
  const numAmount = parseFloat(amount);
  const sign = numAmount >= 0 ? '' : '-';
  return `${sign}$${Math.abs(numAmount).toFixed(2)}`;
};

/**
 * Format card transaction amount with currency code and +/- sign
 */
export const formatCardAmountWithCurrency = (amount: string, currency: string): string => {
  const numAmount = parseFloat(amount);
  return `${numAmount >= 0 ? '+' : ''}${numAmount.toFixed(2)} ${currency.toUpperCase()}`;
};

/**
 * Get cashback amount for a transaction
 * TODO: Replace with actual calculation based on transaction data
 */
export const getCashbackAmount = (): string => {
  return '+$0.34';
};
