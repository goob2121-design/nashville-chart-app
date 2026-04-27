import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pinnacle Recording Studio Chart System",
  description: "Build, edit, save, and print Nashville Number System charts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
