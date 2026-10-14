import { createElement, ReactNode } from 'react';
import { StyleSheet, ViewProps } from 'react-native';

/**
 * Keeps the support chat out of session replays on the web: Amplitude's
 * browser recorder blocks any element with the `amp-block` class. A real DOM
 * element, because a class on a react-native-web View is not guaranteed to
 * reach the page.
 */
export default function ReplayMask({ children, style }: ViewProps & { children: ReactNode }) {
  return createElement(
    'div',
    {
      className: 'amp-block',
      style: {
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        ...(StyleSheet.flatten(style) as Record<string, unknown>),
      },
    },
    children,
  );
}
