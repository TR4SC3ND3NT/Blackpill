"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { fetchJson } from "@/lib/api";
import type { SubscriptionInfo } from "@/lib/types";

type SubscriptionContextValue = {
  subscription: SubscriptionInfo | null;
  loading: boolean;
  error: string | null;
  locked: boolean;
  refresh: () => void;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    let active = true;
    setLoading(true);
    fetchJson<SubscriptionInfo>("/api/subscription")
      .then((res) => {
        if (!active) return;
        setSubscription(res);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load subscription.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const cleanup = refresh();
    return () => {
      if (cleanup) cleanup();
    };
  }, [refresh]);

  const locked = subscription ? subscription.subscription == null : true;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        error,
        locked,
        refresh,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return ctx;
};
