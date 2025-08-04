import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MorphSave - Gamified Micro-Savings Platform",
  description: "Transform the way you save money with MorphSave. Gamified micro-savings built on Morph L2 blockchain for transparent, secure financial growth.",
  keywords: "savings, blockchain, DeFi, gamification, Morph L2, micro-savings",
  authors: [{ name: "MorphSave Team" }],
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
