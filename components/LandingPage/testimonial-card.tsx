"use client";

import { motion } from "framer-motion";
import { variantProps } from "./feature-card";

interface TestimonialCardProps {
  quote: string;
  name: string;
  title: string;
  avatarSrc: string;
  company?: string;
  companySrc?: string;
  variants?: variantProps;
}

export default function TestimonialCard({
  quote,
  name,
  title,
  avatarSrc,
  company,
  companySrc,
  variants,
}: TestimonialCardProps) {
  return (
    <motion.div
      className="flex flex-col p-8 space-y-6 rounded-xl border bg-background shadow-sm hover:shadow-md transition-all h-full group"
      variants={variants}
      whileHover={{ y: -5, transition: { duration: 0.3 } }}
    >
      <div className="flex-1">
        <svg
          className="h-8 w-8 text-primary/40 mb-4 group-hover:text-primary/60 transition-colors"
          fill="currentColor"
          viewBox="0 0 32 32"
          aria-hidden="true"
        >
          <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
        </svg>
        <p className="italic text-muted-foreground mb-4">&quot;{quote}&quot;</p>
      </div>
      <div className="flex items-center gap-4">
        <img
          alt={name}
          className="rounded-full h-12 w-12 object-cover border-2 border-primary/10 group-hover:border-primary/20 transition-colors"
          src={avatarSrc || "/placeholder.svg"}
        />
        <div>
          <h4 className="font-semibold">{name}</h4>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
        {company && (
          <div className="ml-auto">
            <img
              alt={company}
              className="h-6 object-contain"
              src={companySrc || "/placeholder.svg"}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
