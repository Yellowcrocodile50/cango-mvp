"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

function SuccessContent() {
  const searchParams = useSearchParams();
  const { removeItems } = useCart();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = Number(searchParams.get("amount"));

    if (!paymentKey || !orderId || !amount) {
      setStatus("error");
      setErrorMsg("잘못된 접근입니다.");
      return;
    }

    fetch("/api/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          removeItems(data.materialIds);
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMsg(data.error ?? "결제 승인 중 오류가 발생했습니다.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("네트워크 오류가 발생했습니다.");
      });
  }, [searchParams, removeItems]);

  if (status === "loading") {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-[#5a7d50]">결제 확인 중...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">결제 오류</h1>
        <p className="text-[#5a7d50] mb-8">{errorMsg}</p>
        <div className="space-y-3">
          <Link
            href="/checkout"
            className="block w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition flex items-center justify-center"
          >
            다시 시도하기
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

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-16 h-16 bg-[#365927] text-white rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
        ✓
      </div>
      <h1 className="text-2xl font-bold mb-4 text-[#365927]">
        감사합니다. 구매가 완료되었습니다!
      </h1>
      <p className="text-[#5a7d50] mb-2">자료가 발송되면 구매 내역에서 확인하실 수 있습니다.</p>
      <p className="text-[#8aab82] text-sm mb-8">24시간 이내에 발송해드릴게요!</p>
      <div className="space-y-3">
        <Link
          href="/mypage"
          className="block w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition flex items-center justify-center"
        >
          구매 내역 보기
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

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-20 text-center"><p className="text-[#5a7d50]">로딩 중...</p></div>}>
      <SuccessContent />
    </Suspense>
  );
}
