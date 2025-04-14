"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  align?: "left" | "center" | "right";
  size?: "sm" | "md" | "lg";
  withGradient?: boolean;
}

export function PageHeader({
  title,
  description,
  className,
  titleClassName,
  descriptionClassName,
  align = "center",
  size = "lg",
  withGradient = true,
}: PageHeaderProps) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  const titleSize = {
    sm: "text-2xl md:text-3xl",
    md: "text-4xl md:text-4xl",
    lg: "text-5xl md:text-5xl",
  };

  const descriptionSize = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("space-y-2 overflow-visible", alignClass[align], className)}
    >
      <h1
        className={cn(
          titleSize[size],
          "font-bold tracking-tight leading-tight",
          withGradient && "gradient-text",
          titleClassName
        )}
      >
        {title}
      </h1>
      {description && (
        <p
          className={cn(
            "text-muted-foreground max-w-[650px]",
            descriptionSize[size],
            align === "center" && "mx-auto",
            descriptionClassName
          )}
        >
          {description}
        </p>
      )}
    </motion.div>
  );
}
