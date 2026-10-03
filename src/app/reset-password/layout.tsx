import type { Metadata } from "next";

// 비밀번호 재설정 화면은 검색 색인 불필요
export const metadata: Metadata = {
  title: "비밀번호 재설정",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
