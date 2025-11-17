import { createContext, useContext, useRef } from 'react';

const PanGestureContext = createContext<{ isPanning: React.MutableRefObject<boolean> } | null>(
  null,
);

export const PanGestureProvider = ({ children }: { children: React.ReactNode }) => {
  const isPanning = useRef(false);
  return <PanGestureContext.Provider value={{ isPanning }}>{children}</PanGestureContext.Provider>;
};

export const usePanGesture = () => {
  const context = useContext(PanGestureContext);
  return context?.isPanning;
};
