import { Badge } from "@/components/ui/badge";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";
import { checkUser } from "@/lib/checkUser";

async function Header() {
  await checkUser();
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
              <div className="absolute inset-0 rounded-md bg-gradient-to-br from-primary to-primary-foreground opacity-90"></div>
              <div className="absolute inset-0 flex items-center justify-center text-primary-foreground font-bold text-xl">
                E
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
                  <span>Growth Tools</span>
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
                    href="/interview"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span>Interview Prep</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/chatbot"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <BriefcaseBusiness className="h-4 w-4 text-primary" />
                    <span>Agentic Chatbot</span>
                    <Badge
                      variant="outline"
                      className="ml-auto text-xs py-0 h-5"
                    >
                      New
                    </Badge>
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
                    <span>Industry Insights</span>
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
                    href="/interview"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span>Interview Prep</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/career-advisor"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <BriefcaseBusiness className="h-4 w-4 text-primary" />
                    <span>Career Advisor</span>
                    <Badge
                      variant="outline"
                      className="ml-auto text-xs py-0 h-5"
                    >
                      New
                    </Badge>
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
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9 border-2 border-primary/20",
                  userButtonPopoverCard: "shadow-lg",
                  userPreviewMainIdentifier: "font-semibold",
                },
              }}
              afterSignOutUrl="/"
            />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

export default Header;
