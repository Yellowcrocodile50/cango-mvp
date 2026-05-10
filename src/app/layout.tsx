import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { MainShell } from "@/components/MainShell";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cango.kr"),
  title: {
    default: "CANGO - PDF 자료 마켓플레이스",
    template: "%s | CANGO",
  },
  description: "교사·학생을 위한 PDF 학습자료 마켓플레이스. 검증된 자료를 쉽게 구매하고 즉시 다운로드하세요.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://cango.kr",
    siteName: "CANGO",
    title: "CANGO - PDF 자료 마켓플레이스",
    description: "교사·학생을 위한 PDF 학습자료 마켓플레이스. 검증된 자료를 쉽게 구매하고 즉시 다운로드하세요.",
  },
  ...(process.env.NAVER_SITE_VERIFICATION && {
    verification: {
      other: {
        "naver-site-verification": process.env.NAVER_SITE_VERIFICATION,
      },
    },
  }),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <CartProvider>
          <MainShell>{children}</MainShell>
          <Toaster position="top-center" richColors />
        </CartProvider>
      </body>
    </html>
  );
}
