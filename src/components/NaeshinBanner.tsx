"use client";

import { useState } from "react";
import Link from "next/link";

export default function NaeshinBanner() {
  // 새로고침할 때마다 다시 노출 → dismiss는 저장하지 않고 현재 화면에서만 유지.
  // X를 누르면 이번 페이지 로드에서만 닫히고, 새로고침하면 다시 뜬다.
  const [show, setShow] = useState(true);

  if (!show) return null;

  function dismiss() {
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
            가고 싶은 대학, <b className="font-semibold">몇 등급이 필요할까?</b>{" "}
            <span className="whitespace-nowrap">→</span>
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
