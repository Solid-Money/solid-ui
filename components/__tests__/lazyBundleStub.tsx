import React from 'react';

/**
 * Test stand-in for `lazyWithRetry`. This Jest setup can't run dynamic
 * `import()`, so the bundle is never loaded: the stub renders which lazy
 * component was reached instead. The carousel is the one handed `isOpen`.
 */
export const lazyWithRetry = () =>
  function LazyBundleStub(props: Record<string, unknown>) {
    return <>{'isOpen' in props ? 'carousel-popup' : 'single-popup'}</>;
  };

export default lazyWithRetry;
