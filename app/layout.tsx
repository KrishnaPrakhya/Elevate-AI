import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/theme-provider";
import Header from "@/components/header";
import { neobrutalism } from "@clerk/themes";
import { Toaster } from "@/components/ui/sonner";
export const metadata: Metadata = {
  title: "Elevate AI ",
  description: "Level Up your Career",
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: neobrutalism,
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className="font-sans"
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {/* header */}
            <Header />
            <main className="min-h-screen">{children}</main>
            <Toaster richColors />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
