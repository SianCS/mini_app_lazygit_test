import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

// ฟอนต์ที่มีทั้งภาษาไทยและอังกฤษ — สระ/วรรณยุกต์ไม่ลอยเหมือนฟอนต์ระบบบางตัว
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Scan & Speak",
  description: "OCR + TTS ด้วย AI for Thai",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${plexThai.variable} antialiased`}>{children}</body>
    </html>
  );
}
