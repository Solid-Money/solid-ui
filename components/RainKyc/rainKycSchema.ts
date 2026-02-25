import { z } from 'zod';

import type { RainDocumentType } from '@/lib/types';

export const rainKycFormSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    nationalId: z.string().min(1, 'National ID / SSN is required'),
    countryOfIssue: z.string().length(2, 'Use 2-letter country code'),
    email: z.string().email('Valid email required'),
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    region: z.string().min(1, 'State / Region is required'),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().length(2, 'Use 2-letter country code'),
    occupation: z.string().min(1, 'Occupation is required'),
    annualSalary: z.string().min(1, 'Annual salary is required'),
    accountPurpose: z.string().min(1, 'Account purpose is required'),
    expectedMonthlyVolume: z.string().min(1, 'Expected monthly volume is required'),
    isTermsOfServiceAccepted: z
      .boolean()
      .refine(v => v === true, { message: 'You must accept the terms of service' }),
    agreedToEsign: z.boolean().optional(),
    agreedToAccountOpeningPrivacy: z.boolean().optional(),
    agreedToCertify: z.boolean().optional(),
    agreedToNoSolicitation: z.boolean().optional(),
    phoneCountryCode: z.string().min(1, 'Country code is required').max(5),
    phoneNumber: z.string().min(1, 'Phone number is required').max(20),
    idDocumentType: z.enum(['passport', 'idCard', 'drivers', 'residencePermit'] as const),
  })
  .superRefine((data, ctx) => {
    if (data.agreedToEsign !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must agree to the E-Sign Consent to continue',
        path: ['agreedToEsign'],
      });
    }
    if (data.country?.toUpperCase() === 'US' && data.agreedToAccountOpeningPrivacy !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must accept the Account Opening Privacy Notice to continue',
        path: ['agreedToAccountOpeningPrivacy'],
      });
    }
    if (data.agreedToCertify !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must certify that the information provided is accurate',
        path: ['agreedToCertify'],
      });
    }
    if (data.agreedToNoSolicitation !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must acknowledge that applying does not constitute unauthorized solicitation',
        path: ['agreedToNoSolicitation'],
      });
    }
  });

export type RainKycFormData = z.infer<typeof rainKycFormSchema>;

export type RainKycDocumentFiles = {
  idDocumentType: RainDocumentType;
  idDocument?: File | null; // passport: single file
  idDocumentFront?: File | null;
  idDocumentBack?: File | null;
  selfie: File | null;
};
