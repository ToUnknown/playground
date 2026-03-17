import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Rajdhani } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { getSessionUser } from "@/lib/auth/server";
import { publicAppUrl } from "@/lib/env";
import "./globals.css";

const rajdhani = Rajdhani({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(publicAppUrl()),
  title: "Playdround",
  description: "Playdround is a private-feeling browser arcade for friends and leaderboards.",
  applicationName: "Playdround",
  manifest: "/favicon/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    title: "Playdround",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Playdround",
    description: "Playdround is a private-feeling browser arcade for friends and leaderboards.",
    type: "website",
    url: "/",
    siteName: "Playdround",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Playdround",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Playdround",
    description: "Playdround is a private-feeling browser arcade for friends and leaderboards.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141b0f",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionUser = await getSessionUser();

  return (
    <html lang="en">
      <body className={`${rajdhani.variable} ${plexSans.variable}`}>
        <AppProviders initialThemeId={sessionUser?.themeId}>{children}</AppProviders>
      </body>
    </html>
  );
}
