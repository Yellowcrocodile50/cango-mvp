"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function FailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const message = searchParams.get("message");
  const orderId = searchParams.get("orderId");
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current || !orderId) return;
    hasRun.current = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, buyerId: user.id }),
      }).catch(() => {});
    })();
  }, [orderId]);

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
        ✕
      </div>
      <h1 className="text-2xl font-bold mb-4 text-[#365927]">결제에 실패했습니다</h1>
      {message && (
        <p className="text-[#5a7d50] mb-2">{message}</p>
      )}
      {code && (
        <p className="text-xs text-[#8aab82] mb-8">오류 코드: {code}</p>
      )}
      <div className="space-y-3">
        <Link
          href="/cart"
          className="block w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition flex items-center justify-center"
        >
          장바구니로 돌아가기
        </Link>
        <Link
          href="/"
          className="block w-full h-12 border border-[#d6e4d3] text-[#5a7d50] rounded-lg font-medium hover:bg-[#f5f9f4] transition flex items-center justify-center"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}

export default function FailPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-20 text-center"><p className="text-[#5a7d50]">로딩 중...</p></div>}>
      <FailContent />
    </Suspense>
  );
}
