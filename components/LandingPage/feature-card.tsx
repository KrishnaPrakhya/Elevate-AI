"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

export interface variantProps {
  [key: string]: {
    opacity: number;
    y: number;
    transition?: {
      duration: number;
    };
  };
}
interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  variants?: variantProps;
}

export default function FeatureCard({
  icon,
  title,
  description,
  variants,
}: FeatureCardProps) {
  return (
    <motion.div
      className="flex flex-col items-center text-center p-8 space-y-4 rounded-xl border bg-background shadow-sm transition-all hover:shadow-md hover:-translate-y-1 hover:border-primary/20 relative overflow-hidden group"
      variants={variants}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
    >
      <div className="p-3 rounded-full bg-primary/10 mb-2 border border-primary/20 group-hover:bg-primary/15 transition-colors relative z-10">
        {icon}
      </div>
      <h3 className="text-xl font-bold relative z-10">{title}</h3>
      <p className="text-muted-foreground relative z-10">{description}</p>

      {/* Decorative background element */}
      <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-primary/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    </motion.div>
  );
}
