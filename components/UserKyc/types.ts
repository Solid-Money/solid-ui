import { z } from 'zod';

export enum KycMode {
  BANK_TRANSFER = 'bankTransfer',
  CARD = 'card',
}

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
});

export type UserInfoFormData = z.infer<typeof userInfoSchema>;
