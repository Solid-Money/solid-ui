/// <reference types="jest" />
import VAULT_FAQS, { getVaultFaqs } from '@/constants/vault-faqs';
import { VaultType } from '@/lib/types';

/**
 * The vault detail screen used to render one soUSD list on all three vaults, so
 * someone on the ETH vault was told what soUSD is. These lock the split.
 */
describe('vault FAQs', () => {
  it('answers for every vault we actually have', () => {
    for (const vaultType of Object.values(VaultType)) {
      const faqs = getVaultFaqs(vaultType);

      expect(faqs.length).toBeGreaterThan(0);
      for (const faq of faqs) {
        expect(faq.question.trim()).not.toBe('');
        expect(faq.answer.trim()).not.toBe('');
      }
    }
  });

  it('names its own vault token in the opening question', () => {
    expect(VAULT_FAQS[VaultType.USDC][0].question).toContain('soUSD');
    expect(VAULT_FAQS[VaultType.ETH][0].question).toContain('soETH');
    expect(VAULT_FAQS[VaultType.FUSE][0].question).toContain('soFUSE');
    expect(VAULT_FAQS[VaultType.EUR][0].question).toContain('soEURC');
  });

  it('never explains soUSD on the ETH, FUSE or EUR vault', () => {
    for (const vaultType of [VaultType.ETH, VaultType.FUSE, VaultType.EUR]) {
      const copy = getVaultFaqs(vaultType)
        .map(faq => `${faq.question} ${faq.answer}`)
        .join(' ');

      expect(copy).not.toMatch(/what is soUSD/i);
      expect(copy).not.toMatch(/1 soUSD per 1 USDC/i);
    }
  });

  it('ties the FUSE vault to Skip the Line, which is what that deposit unlocks', () => {
    const copy = getVaultFaqs(VaultType.FUSE)
      .map(faq => faq.answer)
      .join(' ');

    expect(copy).toContain('Skip the Line');
    expect(copy).toContain('50,000 FUSE');
    expect(copy).toContain('400,000');
  });

  // No yield yet and a queued withdrawal: the copy must not promise either away.
  it('tells EUR savers what they deposit, that yield is coming, and how long withdrawals take', () => {
    const copy = getVaultFaqs(VaultType.EUR)
      .map(faq => `${faq.question} ${faq.answer}`)
      .join(' ');

    expect(copy).toContain('EURC');
    expect(copy).toContain('Base');
    expect(copy).toMatch(/coming soon/i);
    expect(copy).toMatch(/3 days/);
    expect(copy).not.toMatch(/\d+(\.\d+)?%/);
  });

  it('falls back to the USDC vault for a type that is not a vault', () => {
    expect(getVaultFaqs('doge' as VaultType)).toBe(VAULT_FAQS[VaultType.USDC]);
  });
});
