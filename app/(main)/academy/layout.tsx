"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Trophy, Flame, Users, Target, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/academy", label: "Dashboard", icon: BookOpen },
  { href: "/academy/paths", label: "Learning Paths", icon: BookOpen },
  { href: "/academy/streak", label: "Streak & Goals", icon: Flame },
  { href: "/academy/achievements", label: "Achievements", icon: Trophy },
  { href: "/academy/leaderboard", label: "Leaderboard", icon: Target },
  { href: "/academy/cohorts", label: "Cohorts", icon: Users },
  { href: "/academy/settings", label: "Settings", icon: Settings },
];

export default function AcademyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6">
      {/* Sidebar Navigation */}
      <aside className="w-64 shrink-0">
        <nav className="sticky top-20 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/academy"
                ? pathname === "/academy"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}