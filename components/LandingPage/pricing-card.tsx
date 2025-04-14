"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { variantProps } from "./feature-card";

interface PricingCardProps {
  title: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  buttonText: string;
  popular?: boolean;
  variants?: variantProps;
}

export default function PricingCard({
  title,
  price,
  period,
  description,
  features,
  buttonText,
  popular = false,
  variants,
}: PricingCardProps) {
  return (
    <motion.div
      className={cn(
        "flex flex-col p-8 space-y-6 rounded-xl border bg-background shadow-sm transition-all",
        popular && "border-primary shadow-md relative scale-105 z-10"
      )}
      variants={variants}
      whileHover={{ y: -5, transition: { duration: 0.3 } }}
    >
      {popular && (
        <div className="absolute -top-4 left-0 right-0 mx-auto w-fit px-4 py-1 text-sm font-medium text-primary-foreground bg-primary rounded-full shadow-sm">
          Most Popular
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-2xl font-bold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-1">
        <div className="flex items-baseline">
          <span className="text-4xl font-bold">{price}</span>
          <span className="ml-1 text-muted-foreground">{period}</span>
        </div>
      </div>
      <ul className="space-y-3 pt-4">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-primary/20">
              <Check className="h-3 w-3 text-primary" />
            </div>
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
      <Button
        className={cn(
          "mt-auto group relative overflow-hidden",
          popular
            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
            : ""
        )}
        variant={popular ? "default" : "outline"}
        size="lg"
      >
        <span className="relative z-10">{buttonText}</span>
        <span
          className={cn(
            "absolute inset-0 transition-colors duration-300",
            popular
              ? "bg-primary/0 group-hover:bg-primary/10"
              : "bg-background/0 group-hover:bg-primary/5"
          )}
        ></span>
      </Button>
    </motion.div>
  );
}
