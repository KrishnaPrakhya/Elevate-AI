"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SkeletonLoaderProps {
  className?: string;
}

export function SkeletonLoader({ className = "" }: SkeletonLoaderProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 bg-[length:200%_100%]",
        className
      )}
    />
  );
}

interface ShimmerLoaderProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function ShimmerLoader({ className = "", width, height }: ShimmerLoaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md",
        className
      )}
      style={{ width, height }}
    >
      <div className="absolute inset-0 bg-muted" />
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

interface CardSkeletonProps {
  count?: number;
}

export function CardSkeleton({ count = 1 }: CardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border bg-card p-6 space-y-4"
        >
          <div className="flex items-center gap-4">
            <SkeletonLoader className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <SkeletonLoader className="h-4 w-1/3" />
              <SkeletonLoader className="h-3 w-1/2" />
            </div>
          </div>
          <SkeletonLoader className="h-20 w-full" />
          <div className="flex gap-2">
            <SkeletonLoader className="h-8 w-20" />
            <SkeletonLoader className="h-8 w-20" />
          </div>
        </div>
      ))}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface DashboardSkeletonProps {}

export function DashboardSkeleton({}: DashboardSkeletonProps) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <SkeletonLoader className="h-8 w-48" />
          <SkeletonLoader className="h-4 w-32" />
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-6 space-y-3">
            <SkeletonLoader className="h-4 w-20" />
            <SkeletonLoader className="h-8 w-16" />
            <SkeletonLoader className="h-2 w-full" />
          </div>
        ))}
      </div>

      {/* Main Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <SkeletonLoader className="h-64 w-full rounded-lg" />
          <SkeletonLoader className="h-48 w-full rounded-lg" />
        </div>
        <div className="space-y-4">
          <SkeletonLoader className="h-40 w-full rounded-lg" />
          <SkeletonLoader className="h-60 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface AcademySkeletonProps {}

export function AcademySkeleton({}: AcademySkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header with icon */}
      <div className="flex items-center gap-3">
        <SkeletonLoader className="h-8 w-8 rounded" />
        <div className="space-y-2">
          <SkeletonLoader className="h-8 w-64" />
          <SkeletonLoader className="h-4 w-48" />
        </div>
      </div>

      {/* Skill Constellation Card */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-center gap-2">
          <SkeletonLoader className="h-5 w-5 rounded" />
          <SkeletonLoader className="h-5 w-40" />
        </div>
        <SkeletonLoader className="h-80 w-full rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3 rounded-lg border space-y-2">
              <SkeletonLoader className="h-3 w-16" />
              <SkeletonLoader className="h-6 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Active Simulations */}
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex justify-between">
          <div className="space-y-2">
            <SkeletonLoader className="h-5 w-40" />
            <SkeletonLoader className="h-4 w-56" />
          </div>
          <SkeletonLoader className="h-6 w-20" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 rounded-lg border space-y-3">
            <div className="flex items-start gap-4">
              <SkeletonLoader className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <SkeletonLoader className="h-4 w-3/4" />
                <SkeletonLoader className="h-3 w-1/2" />
                <SkeletonLoader className="h-2 w-full" />
              </div>
              <SkeletonLoader className="h-8 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Hyper-Path Form */}
      <div className="rounded-lg border p-6 space-y-6">
        <div className="space-y-2">
          <SkeletonLoader className="h-5 w-48" />
          <SkeletonLoader className="h-4 w-64" />
        </div>
        <SkeletonLoader className="h-10 w-full" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonLoader key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <div className="flex gap-3">
          <SkeletonLoader className="h-10 flex-1" />
          <SkeletonLoader className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface InterviewSkeletonProps {}

export function InterviewSkeleton({}: InterviewSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <SkeletonLoader className="h-8 w-56" />
        <SkeletonLoader className="h-4 w-72" />
      </div>

      {/* Quiz Cards */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <SkeletonLoader className="h-5 w-48" />
              <SkeletonLoader className="h-4 w-64" />
            </div>
            <SkeletonLoader className="h-8 w-24 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 p-3 rounded-lg border">
                <SkeletonLoader className="h-5 w-5 rounded-full" />
                <SkeletonLoader className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface PulseDotProps {
  color?: "primary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
}

export function PulseDot({ color = "primary", size = "md" }: PulseDotProps) {
  const colorClasses = {
    primary: "bg-primary",
    success: "bg-green-500",
    warning: "bg-amber-500",
    danger: "bg-red-500",
  };

  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  };

  return (
    <div className="relative flex items-center justify-center">
      <div
        className={cn(
          "absolute animate-ping rounded-full opacity-75",
          sizeClasses[size],
          colorClasses[color]
        )}
      />
      <div
        className={cn(
          "relative rounded-full",
          sizeClasses[size],
          colorClasses[color]
        )}
      />
    </div>
  );
}

interface WaveLoaderProps {
  dots?: number;
  color?: string;
}

export function WaveLoader({ dots = 5, color = "text-primary" }: WaveLoaderProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: dots }).map((_, i) => (
        <motion.div
          key={i}
          className={cn("h-2 w-2 rounded-full bg-current", color)}
          animate={{
            y: [0, -12, 0],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
