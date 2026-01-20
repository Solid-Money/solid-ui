import { createContext, useContext, useMemo, useRef } from 'react';

const PanGestureContext = createContext<{ isPanning: React.MutableRefObject<boolean> } | null>(
  null,
);

export const PanGestureProvider = ({ children }: { children: React.ReactNode }) => {
  const isPanning = useRef(false);
  const value = useMemo(() => ({ isPanning }), []);
  return <PanGestureContext.Provider value={value}>{children}</PanGestureContext.Provider>;
};

export const usePanGesture = () => {
  const context = useContext(PanGestureContext);
  return context?.isPanning;
};
