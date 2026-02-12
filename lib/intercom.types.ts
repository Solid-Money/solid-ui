export type IntercomUserAttributes = {
  userId?: string;
  name?: string;
  email?: string;
  customAttributes?: Record<string, string | number | boolean>;
};

export type IntercomAPI = {
  show: () => void;
  showNewMessage: (message?: string) => void;
  update: (attributes: IntercomUserAttributes) => void;
  shutdown: () => void;
  boot: (options?: { hideDefaultLauncher?: boolean }) => void;
};
