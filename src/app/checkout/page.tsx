"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as PortOne from "@portone/browser-sdk/v2";
import type { User } from "@supabase/supabase-js";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { toast } from "sonner";

type PayMethod = "CARD" | "EASY_PAY";

function CheckoutContent() {
  const { items } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();

  const checkoutItems = useMemo(() => {
    const idsParam = searchParams.get("ids");
    if (!idsParam) return items;
    const ids = new Set(idsParam.split(",").filter(Boolean));
    return items.filter((i) => ids.has(i.id));
  }, [items, searchParams]);

  const checkoutTotal = useMemo(
    () => checkoutItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [checkoutItems]
  );

  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>("CARD");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login?redirect=/checkout");
      } else {
        setUser(user);
        setEmail(user.email || "");
        setLoading(false);
      }
    });
  }, [router]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-[#5a7d50]">로딩 중...</p>
      </div>
    );
  }

  if (checkoutItems.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4 text-[#365927]">구매할 자료가 없습니다</h1>
        <Link
          href="/"
          className="inline-block bg-[#365927] text-white px-6 py-3 rounded-lg hover:bg-[#4a7a38] transition"
        >
          자료 둘러보기
        </Link>
      </div>
    );
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!email) {
      alert("이메일을 입력해주세요.");
      return;
    }

    setSubmitting(true);

    const orderId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const rows = checkoutItems.map((i) => ({
      material_id: i.id,
      buyer_id: user.id,
      buyer_email: email,
      buyer_phone: user.user_metadata?.phone || null,
      amount: i.price * i.quantity,
      payment_status: "pending",
      order_id: orderId,
    }));

    const { error } = await supabase.from("orders").insert(rows);
    if (error) {
      toast.error("주문 저장 중 오류가 발생했습니다: " + error.message);
      setSubmitting(false);
      return;
    }

    const orderName =
      checkoutItems.length === 1
        ? checkoutItems[0].title
        : `${checkoutItems[0].title} 외 ${checkoutItems.length - 1}건`;

    const channelKey =
      payMethod === "EASY_PAY"
        ? process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAO!
        : process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_CARD!;

    try {
      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey,
        paymentId: orderId,
        orderName,
        totalAmount: checkoutTotal,
        currency: "CURRENCY_KRW",
        payMethod,
        customer: { email, customerId: user.id },
        redirectUrl: `${window.location.origin}/checkout/success`,
      });

      // 모바일 리다이렉트 방식(카카오페이 모바일 등)은 undefined 반환 — 브라우저가 redirectUrl로 이동
      if (response === undefined) return;

      // 결제 취소 또는 실패 (팝업 방식)
      if (response.code != null) {
        fetch("/api/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, buyerId: user.id }),
        }).catch(() => {});
        toast.error(response.message ?? "결제가 취소되었습니다.");
        setSubmitting(false);
        return;
      }

      // 팝업 방식 성공 — success 페이지로 이동
      router.push(`/checkout/success?paymentId=${orderId}`);
    } catch {
      fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, buyerId: user.id }),
      }).catch(() => {});
      toast.error("결제 요청 중 오류가 발생했습니다. 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold mb-8 text-[#365927]">결제하기</h1>

      <div className="bg-[#eaf2e8] rounded-lg p-5 mb-8">
        <h2 className="font-medium mb-4 text-[#365927]">주문 내역</h2>
        <div className="space-y-3">
          {checkoutItems.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-[#5a7d50]">
                {item.title}
                <span className="ml-1.5 text-[#8aab82]">×{item.quantity}</span>
              </span>
              <span className="font-medium text-[#1a2e16]">
                {(item.price * item.quantity).toLocaleString()}원
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-[#d6e4d3] mt-4 pt-4 flex justify-between">
          <span className="font-bold text-[#365927]">합계</span>
          <span className="font-bold text-lg text-[#365927]">
            {checkoutTotal.toLocaleString()}원
          </span>
        </div>
      </div>

      <form onSubmit={handlePayment}>
        <label className="block mb-2 text-sm font-medium text-[#365927]">
          이메일 주소
        </label>
        <p className="text-xs text-[#5a7d50] mb-3">
          결제 완료 후 이 이메일로 PDF 자료를 보내드립니다.
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
          required
          className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent mb-6 bg-white"
        />

        <label className="block mb-3 text-sm font-medium text-[#365927]">
          결제 수단
        </label>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setPayMethod("CARD")}
            className={`h-12 rounded-lg border-2 text-sm font-medium transition cursor-pointer ${
              payMethod === "CARD"
                ? "border-[#365927] bg-[#eaf2e8] text-[#365927]"
                : "border-[#d6e4d3] text-[#5a7d50] hover:border-[#5a7d50]"
            }`}
          >
            신용/체크카드
          </button>
          <button
            type="button"
            onClick={() => setPayMethod("EASY_PAY")}
            className={`h-12 rounded-lg border-2 text-sm font-medium transition cursor-pointer ${
              payMethod === "EASY_PAY"
                ? "border-[#365927] bg-[#eaf2e8] text-[#365927]"
                : "border-[#d6e4d3] text-[#5a7d50] hover:border-[#5a7d50]"
            }`}
          >
            카카오페이
          </button>
        </div>

        <div className="mb-4 p-3 bg-[#f5f9f4] border border-[#d6e4d3] rounded-lg text-xs text-[#5a7d50] leading-relaxed">
          <p className="font-medium text-[#365927] mb-1">환불 안내</p>
          <p>
            결제 완료 후 24시간 이내 등록 이메일로 자료가 발송됩니다.{" "}
            <strong>자료 발송 메일 열람 전</strong>까지는 7일 이내 전액 환불 가능하며,
            <strong> 메일 열람 후에는 단순 변심에 의한 환불이 불가합니다.</strong>{" "}
            <Link href="/terms" target="_blank" className="underline hover:text-[#365927]">
              전체 환불정책 보기
            </Link>
          </p>
          <p className="mt-2 text-[#8aab82]">결제 시 위 환불정책에 동의한 것으로 간주됩니다.</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-14 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "처리 중..." : `결제하기 (${checkoutTotal.toLocaleString()}원)`}
        </button>
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-20 text-center"><p className="text-[#5a7d50]">로딩 중...</p></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
