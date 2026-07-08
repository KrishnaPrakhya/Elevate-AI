"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  index?: number;
}

export default function FeatureCard({
  icon,
  title,
  description,
  index = 0,
}: FeatureCardProps) {
  return (
    <motion.div
      className="group relative flex flex-col gap-4 rounded-md border bg-card p-6 transition-colors hover:border-primary/40"
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: index * 0.07 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="font-mono-data text-xs tracking-wider text-muted-foreground/70">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="space-y-1.5">
        <h3 className="font-display text-lg font-semibold" style={{ textWrap: "balance" }}>
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="absolute inset-x-6 bottom-0 h-px scale-x-0 bg-primary/40 transition-transform duration-300 group-hover:scale-x-100" />
    </motion.div>
  );
}
