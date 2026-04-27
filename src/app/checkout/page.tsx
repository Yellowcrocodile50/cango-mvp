"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

function CheckoutContent() {
  const { items, removeItems } = useCart();
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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login?redirect=/checkout");
      } else {
        setEmail(user.email || "");
        setPhone(user.user_metadata?.phone || "");
        setUserId(user.id);
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

  if (checkoutItems.length === 0 && !isCompleted) {
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

  if (isCompleted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-[#365927] text-white rounded-full flex items-center justify-center text-3xl mx-auto mb-6">&#10003;</div>
        <h1 className="text-2xl font-bold mb-4 text-[#365927]">
          감사합니다. 구매가 완료되었습니다!
        </h1>
        <p className="text-[#5a7d50] mb-2">
          입력하신 이메일({email})로 자료를 보내드리겠습니다 :)
        </p>
        <p className="text-[#8aab82] text-sm mb-8">
          24시간 이내에 발송해드릴게요!
        </p>
        <Link
          href="/"
          className="inline-block bg-[#365927] text-white px-6 py-3 rounded-lg hover:bg-[#4a7a38] transition"
        >
          메인으로 돌아가기
        </Link>
      </div>
    );
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      alert("이메일을 입력해주세요.");
      return;
    }
    if (!userId) return;

    setSubmitting(true);
    const rows = checkoutItems.map((i) => ({
      material_id: i.id,
      buyer_id: userId,
      buyer_email: email,
      buyer_phone: phone || null,
      amount: i.price * i.quantity,
      payment_status: "done",
    }));

    const { error } = await supabase.from("orders").insert(rows);
    if (error) {
      alert("주문 저장 중 오류가 발생했습니다: " + error.message);
      setSubmitting(false);
      return;
    }

    removeItems(checkoutItems.map((i) => i.id));
    setIsCompleted(true);
    setSubmitting(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold mb-8 text-[#365927]">결제하기</h1>

      {/* Order summary */}
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

      {/* Email form */}
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

        <div className="space-y-3">
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-14 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "처리 중..." : `결제하기 (${checkoutTotal.toLocaleString()}원)`}
          </button>
          <p className="text-xs text-center text-[#8aab82]">
            * MVP 테스트 단계로, 실제 결제는 진행되지 않습니다.
          </p>
        </div>
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
