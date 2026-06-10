import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASR Ad-Library Brand Finder",
  description: "Discover net-new D2C brands from the Meta Ad Library via metapi.io",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
