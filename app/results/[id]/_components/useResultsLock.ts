"use client";

import { useMemo } from "react";
import { useFace } from "./FaceProvider";
import { useSubscription } from "./SubscriptionProvider";

const demoUnlocked = process.env.NEXT_PUBLIC_DEMO_UNLOCK !== "0";

export const useResultsLock = () => {
  const { face } = useFace();
  const { locked: subscriptionLocked } = useSubscription();

  return useMemo(() => {
    if (demoUnlocked) return false;
    return subscriptionLocked || (face?.unlocked === false);
  }, [subscriptionLocked, face]);
};
