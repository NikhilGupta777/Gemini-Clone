import { createContext, useContext, ReactNode } from "react";
import { useSimulation, FrameData } from "../hooks/useSimulation";

interface DetectionCtx {
  frame: FrameData | null;
  connected: boolean;
}

const DetectionContext = createContext<DetectionCtx>({ frame: null, connected: false });

export function DetectionProvider({ children }: { children: ReactNode }) {
  const { frame, connected } = useSimulation();
  return (
    <DetectionContext.Provider value={{ frame, connected }}>
      {children}
    </DetectionContext.Provider>
  );
}

export function useDetection() {
  return useContext(DetectionContext);
}
