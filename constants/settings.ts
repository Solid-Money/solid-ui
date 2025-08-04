import { Href } from "expo-router";

interface Account {
  title: string;
  description: string;
  link: Href;
}

interface Support {
  title: string;
  link: Href;
}

export const accounts: Account[] = [
  {
    title: "Account details",
    description: "Name & email",
    link: "/settings/account",
  },
  {
    title: "Wallet recovery",
    description: "Secure your account",
    link: "/settings/account",
  },
];

export const supports: Support[] = [
  {
    title: "Help & Support",
    link: "/settings/account",
  },
  {
    title: "Legal",
    link: "/settings/account",
  },
  {
    title: "Rate us",
    link: "/settings/account",
  },
];
