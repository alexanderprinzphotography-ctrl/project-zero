"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

/** Einheitliche Listen-/Card-Row-Darstellung - loest die bisherige Aufteilung in rohe <table> (Projekte/Kunden/Team) vs. Div-Rows (Angebote/Zeiten/Katalog) ab. Dezent gestaffeltes Einblenden (MS 10a, Prioritaet 4). */
export function ListContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={cn("flex flex-col gap-2", className)}
    >
      {children}
    </motion.div>
  );
}

export function ListRow({
  href,
  children,
  className,
}: {
  href?: string;
  children: ReactNode;
  className?: string;
}) {
  const rowClassName = cn(
    "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3.5 text-sm transition-colors",
    href && "hover:bg-muted/50",
    className,
  );

  if (href) {
    return (
      <motion.div variants={itemVariants}>
        <Link href={href} className={rowClassName}>
          {children}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div variants={itemVariants} className={rowClassName}>
      {children}
    </motion.div>
  );
}
