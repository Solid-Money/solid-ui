import { TransfiPaymentMethodOption } from '@/lib/types';

const ACRONYM_LABELS: Record<string, string> = {
  ach: 'ACH',
  pix: 'PIX',
  sepa: 'SEPA',
  upi: 'UPI',
};

const formatPaymentMethodLabel = (method: TransfiPaymentMethodOption) => {
  if (method.paymentName?.trim()) {
    const name = method.paymentName.trim();
    return ACRONYM_LABELS[name.toLowerCase()] ?? name;
  }

  return method.paymentCode
    .trim()
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part => ACRONYM_LABELS[part.toLowerCase()] ?? `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ');
};

/** Compact, provider-backed rail labels for the currency rows on the wallet funding screen. */
export const getPaymentMethodChips = (
  methods: TransfiPaymentMethodOption[] | undefined,
  maxVisible = 3,
): string[] => {
  if (!methods?.length) return [];

  const labels = [...new Set(methods.map(formatPaymentMethodLabel).filter(Boolean))];
  const visible = labels.slice(0, maxVisible);
  const remaining = labels.length - visible.length;

  return remaining > 0 ? [...visible, `+${remaining}`] : visible;
};
