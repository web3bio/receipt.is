import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/receipt.scss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Web3 Receipt",
  description: "Web3 Receipt",
  openGraph: {
    title: "Web3 Receipt",
    description: "Web3 Receipt",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
