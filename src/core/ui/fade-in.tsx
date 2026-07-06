"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Sanftes Einblenden des Inhalts beim Laden der Seite.
 */
export function FadeIn({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
