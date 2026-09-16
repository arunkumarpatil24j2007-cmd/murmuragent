import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Murmur Agent",
  description: "AI agent that understands requests, uses tools, and executes multi-step tasks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
