import type { PropsWithChildren } from 'react';

export default function AiApiIntroDisclosure({
  expanded,
  children,
}: PropsWithChildren<{ expanded: boolean }>) {
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)] motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out"
      style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      aria-hidden={!expanded}
      inert={!expanded}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
