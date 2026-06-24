import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { MainShell } from "@/components/MainShell";
import { Toaster } from "sonner";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://www.cango.kr";
const SITE_TITLE = "CANGO - 선배들이 만든 입시 자료";
const SITE_DESCRIPTION =
  "선배들이 직접 만든 입시 자료 PDF 마켓플레이스. 수시·정시·공부법까지 검증된 자료를 쉽게 구매하고 즉시 다운로드하세요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | CANGO",
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "CANGO",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  ...(process.env.NAVER_SITE_VERIFICATION && {
    verification: {
      other: {
        "naver-site-verification": process.env.NAVER_SITE_VERIFICATION,
      },
    },
  }),
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "CANGO",
  alternateName: ["캔고", "캔고 입시"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <CartProvider>
          <MainShell>{children}</MainShell>
          <Toaster position="top-center" richColors />
        </CartProvider>
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
