import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ACCOUNT_RECOVERY_ENABLED } from "@/lib/featureFlags";

// 비밀번호 재설정 화면은 검색 색인 불필요
export const metadata: Metadata = {
  title: "비밀번호 재설정",
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  // 아이디·비밀번호 찾기는 보류 중 — 스위치가 꺼져 있으면 페이지 자체가 없는 것처럼 404
  if (!ACCOUNT_RECOVERY_ENABLED) notFound();
  return children;
}
