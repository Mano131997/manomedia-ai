import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ManoMedia Studio",
  description: "Interne studio voor AI-beelden en -video's",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
