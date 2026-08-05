"use client";

import { motion } from "motion/react";

/**
 * Re-mounts on every navigation, giving each page a gentle fade/slide-in for a
 * smoother feel between routes.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
