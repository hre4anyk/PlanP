import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const clash = localFont({
  src: "./fonts/ClashDisplay-Bold.woff2",
  weight: "700",
  variable: "--font-clash",
  display: "swap",
});

const satoshi = localFont({
  src: [
    { path: "./fonts/Satoshi-Regular.woff2", weight: "400" },
    { path: "./fonts/Satoshi-Medium.woff2", weight: "500" },
    { path: "./fonts/Satoshi-Bold.woff2", weight: "700" },
  ],
  variable: "--font-satoshi",
  display: "swap",
});

const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ACDC AI — proof of how you work with AI",
  description:
    "Your CV shows where you worked. Your AI sessions show how you work. ACDC AI turns them into a profile recruiters can read in 30 seconds.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${clash.variable} ${satoshi.variable} ${mono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <ClerkProvider
          appearance={{
            theme: dark,
            variables: {
              colorPrimary: "#ff4d2e",
              colorBackground: "#111116",
              fontFamily: "var(--font-satoshi), sans-serif",
              borderRadius: "0.5rem",
            },
          }}
        >
          <SiteHeader />
          <main className="flex-1">{children}</main>
        </ClerkProvider>
      </body>
    </html>
  );
}
