import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from '@vercel/analytics/react';
// 💡 1. 作った警告バーの部品をインポート！
import InAppBrowserWarning from "./components/InAppBrowserWarning";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "最強調整",
  description: "最強の日程調整アプリ",
  manifest: '/manifest.json', // 💡 この1行を足すだけ！
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* 💡 2. bodyの一番上にポンッと置く！ */}
        <InAppBrowserWarning />
        
        {children}
        <Analytics />
      </body>
    </html>
  );
}
