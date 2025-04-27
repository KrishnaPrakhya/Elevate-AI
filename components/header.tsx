import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import {
  ChevronDown,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PenBox,
  StarsIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Import the ThemeToggle component at the top
import { ThemeToggle } from "./theme-toggle";
import { checkUser } from "@/lib/checkUser";

async function Header() {
  await checkUser();
  return (
    <header
      className="fixed top-0 w-full border-b bg-background/80 background-blur-md z-50
    supports-[backdrop-filter]:bg-background/60
    flex px-8 py-4 "
    >
      <nav className="flex container mx-auto px-5 h-16 items-center justify-between">
        <Link href={"/"}>
          <Image
            className="h-12 py-1 w-auto object-contain"
            src={"/vercel.svg"}
            width={200}
            height={60}
            alt="Elevate Logo"
          />
        </Link>
        <div className="">
          <div className="gap-[10px] flex">
            <SignedIn>
              <Link href={"/dashboard"}>
                <Button>
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden md:block">Industry Insights</span>
                </Button>
              </Link>
              <div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button>
                      <StarsIcon className="h-4 w-4" />
                      <span className="hidden md:block">Growth Tools</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>
                      <Link
                        href={"/resume"}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Build Resume</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link
                        href={"/coverLetter"}
                        className="flex items-center gap-2"
                      >
                        <PenBox className="h-4 w-4" />
                        <span>Cover Letter</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Link
                        href={"/interview"}
                        className="flex items-center gap-2"
                      >
                        <GraduationCap className="h-4 w-4" />
                        <span>Interview Prep</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SignedIn>
          </div>
        </div>
      </nav>
      <div className="flex items-center pr-5">
        <ThemeToggle />
      </div>
      <div>
        <SignedOut>
          <SignInButton>
            <Button className="mt-[15px]" variant={"outline"}>
              Sign In
            </Button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="mt-[18px]">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10",
                  userButtonPopoverCard: "shadow-xl",
                  userPreviewMainIdentifier: "font-semibold",
                },
              }}
              afterSignOutUrl="/"
            />
          </div>
        </SignedIn>
      </div>
    </header>
  );
}

export default Header;
