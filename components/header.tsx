import { SignedIn, SignedOut, SignInButton, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "./ui/button";
import {
  ChevronDown,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PenBox,
  StarsIcon,
  BriefcaseBusiness,
  Sparkles,
  User,
  LogOut,
  FolderOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "./theme-toggle";
import { checkUser } from "@/lib/checkUser";
import { BookOpen, Trophy, Flame, Users, Mic } from "lucide-react";

async function Header() {
  const user = await checkUser();
  return (
    <header className="fixed top-0 w-full z-50 backdrop-blur-md border-b border-border/40">
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/95 to-background/80"></div>

      <div className="container relative mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo Section */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="relative flex items-center">
            <div className="relative h-8 w-8 overflow-hidden">
              <div className="absolute inset-0 rounded-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 opacity-95"></div>
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <svg
                  viewBox="0 0 32 32"
                  className="h-5.5 w-5.5"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M7 23.5a1 1 0 0 1-.95-.68l-1.1-3.3A1 1 0 0 1 5.9 18h2.4a1 1 0 0 1 .95.68l.55 1.65h12.4l.55-1.65a1 1 0 0 1 .95-.68h2.4a1 1 0 0 1 .95 1.32l-1.1 3.3a1 1 0 0 1-.95.68H7Zm2.2-5.4a1 1 0 0 1-.95-1.32l2.85-8.55A1 1 0 0 1 12.05 7h7.9a1 1 0 0 1 .95.68l2.85 8.55a1 1 0 0 1-.95 1.32H9.2Zm4.15-3.17h5.3L16 10.8l-2.65 4.13Z"
                  />
                </svg>
              </div>
              <div className="absolute -bottom-4 -right-4 h-8 w-8 bg-primary/20 rounded-full blur-xl"></div>
            </div>
            <span className="ml-2 text-xl font-bold tracking-tight">
              Elevate<span className="text-primary">AI</span>
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          <SignedIn>
            <Link href="/dashboard">
              <Button variant="ghost" className="gap-2 px-3">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-3">
                  <StarsIcon className="h-4 w-4" />
                  <span>Career Tools</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link
                    href="/resume"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Build Resume</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/coverLetter"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <PenBox className="h-4 w-4 text-primary" />
                    <span>Cover Letter</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/portfolio"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <span>Portfolio</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/interview"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span>Interview Prep</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/interview/simulator-live"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Mic className="h-4 w-4 text-emerald-500" />
                    <span>Voice Interview</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/chatbot"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <BriefcaseBusiness className="h-4 w-4 text-primary" />
                    <span>AI Career Advisor</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-3">
                  <BookOpen className="h-4 w-4" />
                  <span>Academy</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link
                    href="/academy"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/academy/paths"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span>Learning Paths</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/academy/streak"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span>Streak & Goals</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/academy/achievements"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span>Achievements</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/academy/leaderboard"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Users className="h-4 w-4 text-primary" />
                    <span>Leaderboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/academy/cohorts"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Users className="h-4 w-4 text-primary" />
                    <span>Cohorts</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SignedIn>
        </nav>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center">
          <SignedIn>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Sparkles className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <LayoutDashboard className="h-4 w-4 text-primary" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/resume"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Build Resume</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/coverLetter"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <PenBox className="h-4 w-4 text-primary" />
                    <span>Cover Letter</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/portfolio"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <span>Portfolio</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/interview"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span>Interview Prep</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/interview/simulator-live"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Mic className="h-4 w-4 text-emerald-500" />
                    <span>Voice Interview</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/chatbot"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <BriefcaseBusiness className="h-4 w-4 text-primary" />
                    <span>AI Career Advisor</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/academy"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span>Academy</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SignedIn>
        </div>

        {/* Right Section: Theme Toggle & User */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          <SignedOut>
            <SignInButton>
              <Button variant="default" size="sm" className="ml-2">
                Sign In
              </Button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="cursor-pointer">
                  <Avatar className="h-9 w-9 border-2 border-primary/20">
                    <AvatarImage src={user?.imageUrl || ""} alt={user?.name || ""} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 shadow-lg">
                <DropdownMenuItem className="flex flex-col items-start gap-1 p-2">
                  <span className="font-semibold text-sm">{user?.name}</span>
                  <span className="text-xs text-muted-foreground truncate w-full">{user?.email}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2 cursor-pointer w-full">
                    <User className="h-4 w-4" />
                    <span>Profile Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <SignOutButton redirectUrl="/">
                    <button className="flex items-center w-full gap-2 cursor-pointer text-destructive">
                      <LogOut className="h-4 w-4" />
                      <span>Log out</span>
                    </button>
                  </SignOutButton>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

export default Header;
