import { z } from 'zod';

export enum KycMode {
  BANK_TRANSFER = 'bankTransfer',
  CARD = 'card',
}

// Zod schema for validation (base)
export const userInfoSchema = z.object({
  fullName: z
    .string()
    .min(1, 'Please enter your full name')
    .min(2, 'Full name must be at least 2 characters'),
  email: z
    .string()
    .min(1, 'Please enter your email address')
    .email('Please enter a valid email address'),
  agreedToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms to continue'),
  agreedToEsign: z.boolean().optional(),
});

export type UserInfoFormData = z.infer<typeof userInfoSchema>;
