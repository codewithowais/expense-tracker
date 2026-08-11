import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const SITE_DESCRIPTION =
  "Ledgerly is an open-source, local-first personal finance & expense tracker PWA — offline budgeting, net-worth & asset tracking, debt splitting, Splitwise import, and an AI finance assistant. A privacy-first Mint/YNAB/Splitwise alternative.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Ledgerly — Open-Source Local-First Expense Tracker & Budget App",
    template: "%s · Ledgerly",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Ledgerly",
  keywords: [
    "expense tracker",
    "personal finance",
    "budgeting app",
    "money manager",
    "local-first",
    "offline budgeting app",
    "self-hosted finance app",
    "net worth tracker",
    "Mint alternative",
    "YNAB alternative",
    "Splitwise alternative",
    "AI finance assistant",
    "open source",
    "PWA",
  ],
  authors: [{ name: "Owais Ahmed", url: "https://github.com/codewithowais" }],
  creator: "Owais Ahmed",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ledgerly",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    siteName: "Ledgerly",
    title: "Ledgerly — Open-Source Local-First Expense Tracker & Budget App",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Ledgerly — local-first personal finance tracker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ledgerly — Open-Source Local-First Expense Tracker",
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1730" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakartaSans.variable} ${bricolage.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
