import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { MainShell } from "@/components/MainShell";
import { Toaster } from "sonner";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://www.cango.kr";
// 한글 "캔고"를 title에 병기한다. keywords에만 있으면 신호가 약해
// 한글 브랜드 검색("캔고")에 안 걸린다. 네이버 실측상 브랜드 단독어 노출이 0건이었다.
const SITE_TITLE = "CANGO(캔고) - 선배들이 만든 생기부·대학 입시자료";
const SITE_DESCRIPTION =
  "선배들이 직접 만든 생기부·대학 입시자료 PDF 마켓플레이스. 수시·정시·공부법·기출자료와 무료 내신 계산기까지, 검증된 입시 자료를 쉽게 구매하고 즉시 다운로드하세요.";
const SITE_KEYWORDS = [
  "CANGO",
  "캔고",
  "캔고 입시",
  "입시 자료",
  "생기부",
  "대학 입시자료",
  "수시 자료",
  "정시 자료",
  "기출",
  "공부법",
  "내신 계산기",
  "선배들이 만든 생기부",
  "선배들이 만든 대학",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | CANGO",
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
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

// WebSite + Organization을 @graph로 함께 선언한다.
// 브랜드(특히 한글 "캔고") 검색에서 사이트가 하나의 주체로 인식되게 하려면
// WebSite만으로는 부족하고 Organization이 있어야 한다. 둘을 publisher로 연결한다.
const ORG_ID = `${SITE_URL}/#organization`;
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "CANGO",
      alternateName: ["캔고", "캔고 입시", "cango"],
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/cango-logo.png`,
      },
      description: SITE_DESCRIPTION,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "CANGO",
      alternateName: ["캔고", "캔고 입시"],
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "ko-KR",
      publisher: { "@id": ORG_ID },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistMono.variable} h-full antialiased`}
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
