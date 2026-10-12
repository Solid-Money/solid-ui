/**
 * Whether the support chat is on screen and the app is in the foreground.
 * The notification handler reads it to hold back the banner for a support
 * reply the user is already looking at; anywhere else in the app it shows.
 */
let focused = false;

export const setSupportChatFocused = (value: boolean) => {
  focused = value;
};

export const isSupportChatFocused = () => focused;

export const SUPPORT_PUSH_TYPE = 'support_message';
