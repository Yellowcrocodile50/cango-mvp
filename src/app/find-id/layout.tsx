import type { Metadata } from "next";

// 아이디 찾기 화면은 검색 색인 불필요
export const metadata: Metadata = {
  title: "아이디 찾기",
  robots: { index: false, follow: false },
};

export default function FindIdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
