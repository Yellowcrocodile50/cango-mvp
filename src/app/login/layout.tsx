import type { Metadata } from "next";

// 로그인 페이지는 검색 색인 불필요
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
