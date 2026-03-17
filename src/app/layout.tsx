import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Rajdhani } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { getSessionUser } from "@/lib/auth/server";
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
  title: "Friends Arcade",
  description: "A private-feeling browser arcade for friends and leaderboards.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#cec8b8",
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
