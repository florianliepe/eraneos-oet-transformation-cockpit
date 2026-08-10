import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "eraneos Transformation Cockpit | OET AI Suite",
  description: "AI-assisted project and transformation management with governed evidence and decisions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
