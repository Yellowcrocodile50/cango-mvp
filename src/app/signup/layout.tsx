import type { Metadata } from "next";

// 회원가입 페이지는 검색 색인 불필요
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
