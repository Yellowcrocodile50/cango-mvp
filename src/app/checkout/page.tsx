"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import * as PortOne from "@portone/browser-sdk/v2";
import type { User } from "@supabase/supabase-js";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import { BANK_ACCOUNT } from "@/lib/companyInfo";
import { BANK_ORDER_KEY } from "@/lib/bankOrder";
import Link from "next/link";
import { toast } from "sonner";

type PayMethod = "CARD" | "EASY_PAY" | "BANK_TRANSFER";

// PG 심사 완료 후 각각 true로 변경
const CARD_LIVE = false;
const EASY_PAY_LIVE = false;

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
  const [payMethod, setPayMethod] = useState<PayMethod>("BANK_TRANSFER");
  const [cashReceiptWanted, setCashReceiptWanted] = useState(false);
  const [cashReceiptPhone, setCashReceiptPhone] = useState("");
  const [cashReceiptPhoneTouched, setCashReceiptPhoneTouched] = useState(false);
  const [accountCopied, setAccountCopied] = useState(false);

  // 비로그인 전용 상태
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);

  const cashReceiptPhoneIncomplete = cashReceiptPhone.replace(/\D/g, "").length !== 11;

  const copyAccountNumber = async () => {
    try {
      await navigator.clipboard.writeText(BANK_ACCOUNT.number.replace(/-/g, ""));
      setAccountCopied(true);
      setTimeout(() => setAccountCopied(false), 2000);
    } catch {
      toast.error("계좌번호 복사에 실패했습니다. 직접 입력해주세요.");
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) setEmail(user.email || "");
      setLoading(false);
    });
  }, []);

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

  const isGuest = !user;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isGuest) {
      if (!guestEmail) { toast.error("이메일을 입력해주세요."); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) { toast.error("올바른 이메일 형식으로 입력해주세요."); return; }
      if (!guestPhone || guestPhone.replace(/\D/g, "").length < 10) { toast.error("전화번호를 올바르게 입력해주세요."); return; }
      if (!privacyAgreed) { toast.error("개인정보 수집 및 이용에 동의해주세요."); return; }
    } else {
      if (!email) { toast.error("이메일을 입력해주세요."); return; }
    }

    if (payMethod === "BANK_TRANSFER" && cashReceiptWanted && cashReceiptPhoneIncomplete) {
      setCashReceiptPhoneTouched(true);
      toast.error("현금영수증 발행을 위한 휴대폰 번호 11자리를 입력해주세요.");
      return;
    }

    setSubmitting(true);

    const orderId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const buyerEmail = isGuest ? guestEmail : email;
    const buyerPhone = isGuest ? guestPhone : (user?.user_metadata?.phone || null);

    const rows = checkoutItems.map((i) => ({
      material_id: i.id,
      buyer_id: isGuest ? null : user!.id,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      amount: i.price * i.quantity,
      payment_status: "pending",
      order_id: orderId,
      payment_method: payMethod === "BANK_TRANSFER" ? "bank_transfer" : "portone",
      cash_receipt_requested: payMethod === "BANK_TRANSFER" ? cashReceiptWanted : false,
      cash_receipt_phone: payMethod === "BANK_TRANSFER" && cashReceiptWanted ? cashReceiptPhone.trim() : null,
    }));

    if (payMethod === "BANK_TRANSFER") {
      try {
        sessionStorage.setItem(
          BANK_ORDER_KEY,
          JSON.stringify({ orderId, rows, materialIds: checkoutItems.map((i) => i.id) })
        );
      } catch {
        toast.error("주문 정보를 준비하는 중 오류가 발생했습니다. 다시 시도해주세요.");
        setSubmitting(false);
        return;
      }
      const receiptParam = cashReceiptWanted ? "&receipt=1" : "";
      router.push(`/checkout/bank-pending?orderId=${orderId}&amount=${checkoutTotal}${receiptParam}`);
      return;
    }

    // 카드/간편결제 — 로그인 사용자 전용
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

    const cancelOrder = () => {
      fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, buyerId: user!.id }),
      }).catch(() => {});
    };

    try {
      const response = await PortOne.requestPayment({
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
        channelKey,
        paymentId: orderId,
        orderName,
        totalAmount: checkoutTotal,
        currency: "CURRENCY_KRW",
        payMethod,
        customer: { email, customerId: user!.id },
        redirectUrl: `${window.location.origin}/checkout/success`,
      });

      if (response === undefined) return;

      if (response.code != null) {
        cancelOrder();
        toast.error(response.message ?? "결제가 취소되었습니다.");
        setSubmitting(false);
        return;
      }

      router.push(`/checkout/success?paymentId=${orderId}`);
    } catch (error) {
      console.error("[PortOne] requestPayment threw:", error);
      cancelOrder();
      toast.error("결제 요청 중 오류가 발생했습니다. 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold mb-8 text-[#365927]">결제하기</h1>

      {/* 주문 내역 */}
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
        {/* 비로그인: 주문자 정보 입력 */}
        {isGuest ? (
          <div className="mb-6 space-y-4">
            <h2 className="text-sm font-medium text-[#365927]">주문자 정보</h2>
            <div>
              <label className="block mb-1 text-sm text-[#5a7d50]">이메일</label>
              <p className="text-xs text-[#8aab82] mb-2">
                결제 완료 후 이 이메일로 PDF 자료를 보내드립니다.
              </p>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="example@email.com"
                required
                className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
              />
            </div>
            <div>
              <label className="block mb-1 text-sm text-[#5a7d50]">전화번호</label>
              <input
                type="tel"
                value={guestPhone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                  const formatted =
                    digits.length <= 3 ? digits
                    : digits.length <= 7 ? `${digits.slice(0, 3)}-${digits.slice(3)}`
                    : `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                  setGuestPhone(formatted);
                }}
                placeholder="010-1234-5678"
                required
                className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
              />
            </div>
          </div>
        ) : (
          /* 로그인: 이메일 확인 */
          <div className="mb-6">
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
              className="w-full h-12 px-4 border border-[#d6e4d3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
            />
          </div>
        )}

        {/* 결제 수단 */}
        <label className="block mb-3 text-sm font-medium text-[#365927]">
          결제 수단
        </label>
        {isGuest ? (
          /* 비로그인: 계좌이체만 */
          <div className="mb-6">
            <div className="h-12 flex items-center justify-center rounded-lg border-2 border-[#365927] bg-[#eaf2e8] text-[#365927] text-sm font-medium">
              계좌이체
            </div>
            <p className="text-xs text-[#8aab82] mt-2">
              회원가입 후 로그인하시면 카드·카카오페이 결제도 이용하실 수 있습니다.
            </p>
          </div>
        ) : (
          /* 로그인: 전체 결제 수단 */
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button
              type="button"
              disabled={!CARD_LIVE}
              onClick={() => setPayMethod("CARD")}
              className={`min-h-[3rem] py-2 rounded-lg border-2 text-sm font-medium transition ${
                !CARD_LIVE
                  ? "border-[#d6e4d3] text-[#b0c8ab] cursor-not-allowed bg-[#f5f9f4]"
                  : payMethod === "CARD"
                  ? "border-[#365927] bg-[#eaf2e8] text-[#365927] cursor-pointer"
                  : "border-[#d6e4d3] text-[#5a7d50] hover:border-[#5a7d50] cursor-pointer"
              }`}
            >
              신용카드
              {!CARD_LIVE && <span className="block text-[10px] mt-0.5">준비 중</span>}
            </button>
            <button
              type="button"
              disabled={!EASY_PAY_LIVE}
              onClick={() => setPayMethod("EASY_PAY")}
              className={`min-h-[3rem] py-2 rounded-lg border-2 text-sm font-medium transition ${
                !EASY_PAY_LIVE
                  ? "border-[#d6e4d3] text-[#b0c8ab] cursor-not-allowed bg-[#f5f9f4]"
                  : payMethod === "EASY_PAY"
                  ? "border-[#365927] bg-[#eaf2e8] text-[#365927] cursor-pointer"
                  : "border-[#d6e4d3] text-[#5a7d50] hover:border-[#5a7d50] cursor-pointer"
              }`}
            >
              카카오페이
              {!EASY_PAY_LIVE && <span className="block text-[10px] mt-0.5">준비 중</span>}
            </button>
            <button
              type="button"
              onClick={() => setPayMethod("BANK_TRANSFER")}
              className={`min-h-[3rem] py-2 rounded-lg border-2 text-sm font-medium transition cursor-pointer ${
                payMethod === "BANK_TRANSFER"
                  ? "border-[#365927] bg-[#eaf2e8] text-[#365927]"
                  : "border-[#d6e4d3] text-[#5a7d50] hover:border-[#5a7d50]"
              }`}
            >
              계좌이체
            </button>
          </div>
        )}

        {/* 계좌이체: 입금 안내 + 현금영수증 */}
        {(isGuest || payMethod === "BANK_TRANSFER") && (
          <>
            <div className="mb-4 p-4 bg-[#f5f9f4] border border-[#d6e4d3] rounded-lg text-sm">
              <p className="font-medium text-[#365927] mb-2">입금 계좌 안내</p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[#1a2e16] font-mono text-base font-semibold">
                  {BANK_ACCOUNT.bank} {BANK_ACCOUNT.number}
                </p>
                <button
                  type="button"
                  onClick={copyAccountNumber}
                  className="text-xs text-[#365927] bg-white border border-[#b8d9b4] px-2.5 py-0.5 rounded-full hover:bg-[#d6edcf] transition cursor-pointer"
                >
                  {accountCopied ? "✓ 복사됨" : "복사"}
                </button>
              </div>
              <p className="text-[#5a7d50] mt-1">예금주: {BANK_ACCOUNT.holder}</p>
              <p className="text-[#8aab82] text-xs mt-2">
                주문 후 2일 이내 입금하지 않으면 주문이 자동 취소됩니다.
              </p>
            </div>

            <div className="mb-6 p-4 bg-white border border-[#d6e4d3] rounded-lg text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cashReceiptWanted}
                  onChange={(e) => {
                    setCashReceiptWanted(e.target.checked);
                    if (!e.target.checked) { setCashReceiptPhone(""); setCashReceiptPhoneTouched(false); }
                  }}
                  className="w-4 h-4 accent-[#365927] cursor-pointer"
                />
                <span className="font-medium text-[#1a2e16]">현금영수증 발행 신청</span>
              </label>
              {cashReceiptWanted && (
                <div className="mt-3">
                  <p className="text-xs text-[#8aab82] mb-2">
                    소득공제용 현금영수증을 발행해 드립니다. 입금 확인 후 처리됩니다.
                  </p>
                  <input
                    type="tel"
                    value={cashReceiptPhone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                      const formatted =
                        digits.length <= 3 ? digits
                        : digits.length <= 7 ? `${digits.slice(0, 3)}-${digits.slice(3)}`
                        : `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
                      setCashReceiptPhone(formatted);
                    }}
                    onBlur={() => setCashReceiptPhoneTouched(true)}
                    placeholder="010-0000-0000"
                    className={`w-full h-10 px-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent bg-white ${
                      cashReceiptPhoneTouched && cashReceiptPhoneIncomplete
                        ? "border-red-400 focus:ring-red-400"
                        : "border-[#d6e4d3] focus:ring-[#365927]"
                    }`}
                  />
                  {cashReceiptPhoneTouched && cashReceiptPhoneIncomplete && (
                    <p className="mt-1.5 text-xs text-red-500">
                      010 포함 11자리를 모두 입력해주세요. (예: 010-1234-5678)
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* 환불 안내 */}
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

        {/* 비로그인 동의 항목 */}
        {isGuest && (
          <div className="mb-6 space-y-3 p-4 bg-white border border-[#d6e4d3] rounded-lg text-sm">
            {/* 전체 동의 */}
            <div className="flex items-center gap-3 pb-3 border-b border-[#d6e4d3]">
              <input
                id="agree-all"
                type="checkbox"
                checked={privacyAgreed && marketingAgreed}
                onChange={(e) => {
                  setPrivacyAgreed(e.target.checked);
                  setMarketingAgreed(e.target.checked);
                }}
                className="h-4 w-4 rounded border-[#d6e4d3] accent-[#365927] cursor-pointer"
              />
              <label htmlFor="agree-all" className="font-semibold text-[#365927] cursor-pointer">
                전체 동의
              </label>
            </div>
            {/* 개인정보 필수 */}
            <div className="flex items-start gap-3">
              <input
                id="privacy"
                type="checkbox"
                checked={privacyAgreed}
                onChange={(e) => setPrivacyAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#d6e4d3] accent-[#365927] cursor-pointer"
              />
              <label htmlFor="privacy" className="text-[#365927] cursor-pointer leading-snug">
                <span className="font-medium">[필수]</span>{" "}
                <Link href="/privacy" target="_blank" className="underline hover:text-[#4a7a38]">
                  개인정보 수집 및 이용에 동의합니다
                </Link>
              </label>
            </div>
            {/* 마케팅 선택 */}
            <div className="flex items-start gap-3">
              <input
                id="marketing"
                type="checkbox"
                checked={marketingAgreed}
                onChange={(e) => setMarketingAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#d6e4d3] accent-[#5a7d50] cursor-pointer"
              />
              <label htmlFor="marketing" className="text-[#5a7d50] cursor-pointer leading-snug">
                <span className="font-medium">[선택]</span>{" "}
                <Link href="/marketing-terms" target="_blank" className="underline hover:text-[#365927]">
                  마케팅 정보 수신에 동의합니다
                </Link>
              </label>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-14 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? "처리 중..."
            : `주문하기 (${checkoutTotal.toLocaleString()}원)`}
        </button>

        {isGuest && (
          <p className="text-center text-xs text-[#8aab82] mt-4">
            회원이시라면{" "}
            <Link href={`/login?redirect=/checkout`} className="text-[#365927] underline">
              로그인
            </Link>
            {" "}후 결제하시면 마이페이지에서 구매 내역을 확인할 수 있습니다.
          </p>
        )}
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
