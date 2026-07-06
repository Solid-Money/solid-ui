import { Faq } from '@/lib/types';

const passkeyFaqs: Faq[] = [
  {
    question: 'What is a passkey and why is it more secure than a password?',
    answer:
      "A passkey lets you log into Solid using your device's biometrics (Face ID, fingerprint) or PIN instead of a password. It's stored locally on your device (never with Solid's) and is phishing-resistant by design, making it significantly harder to steal or compromise than a traditional password.",
  },
  {
    question: "Why can't I see the passkey option when logging in?",
    answer:
      "Passkeys require a compatible device and browser, make sure you're on a recent version of iOS, Android, Chrome, or Safari.",
  },
  {
    question: 'Can I use my passkey across multiple devices?',
    answer:
      "Yes, if you use a password manager that supports passkeys (like iCloud Keychain or Google Password Manager), your passkey syncs across your devices automatically. Otherwise, you'll need to create a separate passkey on each new device.",
  },
  {
    question: 'What happens if I lose my device?',
    answer:
      "Your passkey is tied to your device, not your account. If you lose access to your phone, visit the Passkey Recovery link on the login screen, enter your email, and we'll send you a verification code to regain access. Once in, you can set up a new passkey on your new device.",
  },
];

export default passkeyFaqs;
