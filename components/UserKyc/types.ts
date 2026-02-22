import { z } from 'zod';

import { RainConsumerType } from '@/lib/types';

export { RainConsumerType };

export enum KycMode {
  BANK_TRANSFER = 'bankTransfer',
  CARD = 'card',
}

// Rain US Consumer: 5 checkboxes. International: 4 (no Account Opening Privacy).
export const userInfoSchema = z.object({
  fullName: z
    .string()
    .min(1, { error: 'Please enter your full name' })
    .min(2, { error: 'Full name must be at least 2 characters' }),
  email: z.email({ error: 'Please enter a valid email address' }),
  agreedToTerms: z
    .boolean()
    .refine(val => val === true, { error: 'You must agree to the terms to continue' }),
  agreedToEsign: z.boolean().optional(),
  agreedToAccountOpeningPrivacy: z.boolean().optional(),
  agreedToCertify: z.boolean().optional(),
  agreedToNoSolicitation: z.boolean().optional(),
});

export type UserInfoFormData = z.infer<typeof userInfoSchema>;
