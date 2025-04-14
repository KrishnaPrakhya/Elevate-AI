"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { variantProps } from "./feature-card";

interface StatCardProps {
  value: string;
  label: string;
  icon: ReactNode;
  variants?: variantProps;
}

export default function StatCard({
  value,
  label,
  icon,
  variants,
}: StatCardProps) {
  return (
    <motion.div
      className="flex flex-col items-center text-center p-6 space-y-2 rounded-xl border bg-background shadow-sm hover:shadow-md transition-all group"
      variants={variants}
      whileHover={{ y: -5, transition: { duration: 0.3 } }}
    >
      <div className="p-2 rounded-full bg-primary/10 mb-2 border border-primary/20 group-hover:bg-primary/15 transition-colors">
        {icon}
      </div>
      <h3 className="text-3xl font-bold">{value}</h3>
      <p className="text-sm text-muted-foreground">{label}</p>
    </motion.div>
  );
}
