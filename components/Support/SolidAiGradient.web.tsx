import { useMemo } from 'react';

import { solidAiGradientHtml } from './solidAiGradientRenderer';

export default function SolidAiGradient({ size, still }: { size: number; still: boolean }) {
  const html = useMemo(() => solidAiGradientHtml(still, size), [size, still]);
  return (
    <iframe
      title=""
      aria-hidden
      tabIndex={-1}
      sandbox="allow-scripts"
      srcDoc={html}
      style={{ display: 'block', width: '100%', height: '100%', border: 0, pointerEvents: 'none' }}
    />
  );
}
