import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import Header from "@/components/header";
import { neobrutalism } from "@clerk/themes";
import { Toaster } from "@/components/ui/sonner";
export const metadata: Metadata = {
  title: "Elevate AI ",
  description: "Level Up your Career",
};
const inter = Inter({ subsets: ["latin"] });

// Landing-page-only type system. Exposed as CSS variables so the marketing
// page can opt in via the .font-display / .font-landing-body / .font-mono-data
// utility classes (see globals.css) without changing the app's default Inter.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-landing-body",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-data",
});
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
          className={`${inter.className} ${bricolage.variable} ${plexSans.variable} ${plexMono.variable}`}
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
