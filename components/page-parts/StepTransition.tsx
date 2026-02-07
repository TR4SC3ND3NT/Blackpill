"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

type Props = {
  stepKey: string;
  children: ReactNode;
};

export default function StepTransition({ stepKey, children }: Props) {
  return (
    <motion.div
      key={stepKey}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35 }}
    >
      {children}
    </motion.div>
  );
}
