"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISS_KEY = "naeshin_banner_dismissed_v1";

export default function NaeshinBanner() {
  // 서버/초기엔 숨김 → 마운트 후 localStorage 확인해서 표시(잘못된 상태 깜빡임 방지)
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 클라이언트 마운트 후 dismiss 여부 확인 (SSR-safe + hydration mismatch 방지)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem(DISMISS_KEY) !== "1") setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  return (
    <div className="w-full bg-[#365927] text-white">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <Link
          href="/naeshin"
          className="flex-1 text-xs sm:text-sm leading-snug hover:underline"
        >
          <span className="block md:inline">
            🎓 <b className="font-semibold">내신 계산기 오픈!</b>{" "}
            <span className="align-middle text-[10px] font-bold bg-white/20 rounded-full px-1.5 py-0.5 whitespace-nowrap">
              무료
            </span>
          </span>{" "}
          <span className="block md:inline">
            내 성적으로 목표 대학 합격 가능성{" "}
            <span className="whitespace-nowrap">확인하기 →</span>
          </span>
        </Link>
        <button
          onClick={dismiss}
          aria-label="배너 닫기"
          className="shrink-0 -mr-1 px-1.5 text-white/70 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
