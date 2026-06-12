"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BANK_ACCOUNT } from "@/lib/companyInfo";

function BankPendingContent() {
  const searchParams = useSearchParams();
  const amount = Number(searchParams.get("amount") || 0);

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
      <div className="w-16 h-16 bg-[#eaf2e8] rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
        🏦
      </div>
      <h1 className="text-2xl font-bold text-center mb-2 text-[#365927]">입금 안내</h1>
      <p className="text-center text-[#5a7d50] mb-8">
        아래 계좌로 입금해주시면 확인 후 자료를 발송해드립니다.
      </p>

      <div className="bg-[#eaf2e8] rounded-xl p-6 mb-6 text-center">
        <p className="text-sm text-[#5a7d50] mb-1">{BANK_ACCOUNT.bank}</p>
        <p className="text-2xl font-bold text-[#1a2e16] font-mono tracking-wider mb-1">
          {BANK_ACCOUNT.number}
        </p>
        <p className="text-sm text-[#5a7d50]">예금주: {BANK_ACCOUNT.holder}</p>
      </div>

      {amount > 0 && (
        <div className="flex justify-between items-center bg-white border border-[#d6e4d3] rounded-lg px-5 py-4 mb-6">
          <span className="text-[#5a7d50] font-medium">입금 금액</span>
          <span className="text-xl font-bold text-[#365927]">{amount.toLocaleString()}원</span>
        </div>
      )}

      <div className="space-y-3 text-sm text-[#5a7d50] bg-[#f5f9f4] rounded-lg p-4 mb-8">
        <p>✓ 입금 확인 후 <strong className="text-[#365927]">24시간 이내</strong> 등록 이메일로 자료를 발송해드립니다.</p>
        <p>✓ 주문 후 <strong className="text-[#365927]">2일 이내</strong> 입금하지 않으면 주문이 자동 취소됩니다.</p>
        <p>✓ 입금자명과 주문 이메일이 다를 경우 고객센터로 문의해 주세요.</p>
      </div>

      <div className="space-y-3">
        <Link
          href="/mypage"
          className="block w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition flex items-center justify-center"
        >
          마이페이지 보기
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

export default function BankPendingPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-20 text-center"><p className="text-[#5a7d50]">로딩 중...</p></div>}>
      <BankPendingContent />
    </Suspense>
  );
}
