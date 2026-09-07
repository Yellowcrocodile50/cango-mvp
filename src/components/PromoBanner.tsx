"use client";

import { useState } from "react";
import Link from "next/link";
import { trackBannerClick } from "@/lib/ga";

/* 도구가 2개가 되면서 배너도 2개가 됐다. 내신 배너를 복사해 색만 바꾸는 대신 공통으로 뺀다
   (도구 레지스트리와 같은 원칙 — 도구가 늘어도 손댈 곳이 한 군데여야 한다). */

/** 배너 색. 도구마다 다른 색을 써서 두 줄이 한 덩어리로 뭉쳐 보이지 않게 한다. */
const TONES = {
  /** 내신 계산기 — 사이트 기본 초록 */
  green: "bg-[#365927]",
  /** 진로 탐구 — 내신 계산기 안내 상자에서 쓰는 파랑과 같은 값 */
  blue: "bg-[#3a5a8f]",
  /* 원서 조준 테스트 — 시즌 한정이라 초록·파랑 계열에서 벗어나 눈에 걸리게 둔다.
     도구 안에서 '상향'(가장 도전적인 카드)에 쓰는 자주색과 같은 계열이라 컨셉과도 붙는다.
     ⚠️ 앰버는 쓰지 않는다(자료 CTA에서 한 번 걸러낸 색). */
  plum: "bg-[#a8355a]",
} as const;

export default function PromoBanner({
  href,
  tone,
  children,
}: {
  href: string;
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  // 새로고침할 때마다 다시 노출 → dismiss는 저장하지 않고 현재 화면에서만 유지.
  // X를 누르면 이번 페이지 로드에서만 닫히고, 새로고침하면 다시 뜬다.
  const [show, setShow] = useState(true);

  if (!show) return null;

  return (
    <div className={`w-full ${TONES[tone]} text-white`}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <Link
          href={href}
          onClick={() => trackBannerClick(href)}
          className="flex-1 text-xs sm:text-sm leading-snug hover:underline"
        >
          {children}
        </Link>
        <button
          onClick={() => setShow(false)}
          aria-label="배너 닫기"
          className="shrink-0 -mr-1 px-1.5 text-white/70 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}

/** 배너 안에서 "무료"처럼 강조하는 작은 알약 */
export function BannerPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="align-middle text-[10px] font-bold bg-white/20 rounded-full px-1.5 py-0.5 whitespace-nowrap">
      {children}
    </span>
  );
}
