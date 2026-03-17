"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const ConvexAvailabilityContext = createContext({ available: false });

export function OptionalConvexProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const [client] = useState(() =>
    url ? new ConvexReactClient(url) : null,
  );

  const value = useMemo(() => ({ available: Boolean(client) }), [client]);

  if (!client) {
    return (
      <ConvexAvailabilityContext.Provider value={value}>
        {children}
      </ConvexAvailabilityContext.Provider>
    );
  }

  return (
    <ConvexAvailabilityContext.Provider value={value}>
      <ConvexProvider client={client}>{children}</ConvexProvider>
    </ConvexAvailabilityContext.Provider>
  );
}

export function useConvexAvailability() {
  return useContext(ConvexAvailabilityContext);
}
