import type { Metadata } from "next";
import "./globals.css";
import "./reader-system.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Phrase du jour",
  description: "Application de correction progressive de phrases pour la classe de français."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
