"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BANK_ACCOUNT } from "@/lib/companyInfo";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

function BankPendingContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") ?? "";
  const amount = Number(searchParams.get("amount") || 0);

  const [depositorName, setDepositorName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!depositorName.trim()) {
      toast.error("입금자명을 입력해주세요.");
      return;
    }
    if (!orderId) {
      toast.error("주문 정보가 올바르지 않습니다.");
      return;
    }
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/set-depositor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ orderId, depositorName }),
    });

    if (res.ok) {
      setSaved(true);
      toast.success("입금자명이 저장되었습니다.");
    } else {
      toast.error("저장에 실패했습니다. 다시 시도해주세요.");
    }
    setSaving(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
      <div className="w-16 h-16 bg-[#eaf2e8] rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
        🏦
      </div>
      <h1 className="text-2xl font-bold text-center mb-2 text-[#365927]">입금 안내</h1>
      <p className="text-center text-[#5a7d50] mb-8">
        아래 계좌로 입금해주시면 확인 후 자료를 발송해드립니다.
      </p>

      {/* 계좌 정보 */}
      <div className="bg-[#eaf2e8] rounded-xl p-6 mb-6 text-center">
        <p className="text-sm text-[#5a7d50] mb-1">{BANK_ACCOUNT.bank}</p>
        <p className="text-2xl font-bold text-[#1a2e16] font-mono tracking-wider mb-1">
          {BANK_ACCOUNT.number}
        </p>
        <p className="text-sm text-[#5a7d50]">예금주: {BANK_ACCOUNT.holder}</p>
      </div>

      {/* 입금 금액 */}
      {amount > 0 && (
        <div className="flex justify-between items-center bg-white border border-[#d6e4d3] rounded-lg px-5 py-4 mb-6">
          <span className="text-[#5a7d50] font-medium">입금 금액</span>
          <span className="text-xl font-bold text-[#365927]">{amount.toLocaleString()}원</span>
        </div>
      )}

      {/* 입금자명 입력 */}
      <div className="bg-white border border-[#d6e4d3] rounded-lg p-5 mb-6">
        <p className="text-sm font-medium text-[#365927] mb-1">입금자명 확인</p>
        <p className="text-xs text-[#8aab82] mb-3">
          은행 앱에서 이체할 때 사용할 이름을 입력해주세요. 입금자명이 다르면 확인이 지연될 수 있습니다.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={depositorName}
            onChange={(e) => { setDepositorName(e.target.value); setSaved(false); }}
            placeholder="홍길동"
            className="flex-1 h-10 px-3 border border-[#d6e4d3] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent bg-white"
          />
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`h-10 px-4 rounded-lg text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed ${
              saved
                ? "bg-[#eaf2e8] text-[#365927] border border-[#365927]"
                : "bg-[#365927] text-white hover:bg-[#4a7a38] disabled:opacity-50"
            }`}
          >
            {saved ? "✓ 저장됨" : saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* 안내 문구 */}
      <div className="space-y-3 text-sm text-[#5a7d50] bg-[#f5f9f4] rounded-lg p-4 mb-8">
        <p>✓ 입금 확인 후 <strong className="text-[#365927]">24시간 이내</strong> 등록 이메일로 자료를 발송해드립니다.</p>
        <p>✓ 주문 후 <strong className="text-[#365927]">2일 이내</strong> 입금하지 않으면 주문이 자동 취소됩니다.</p>
        <p>✓ 입금자명이 다를 경우{" "}
          <a
            href="https://pf.kakao.com/_xnANbX/chat"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#365927] font-medium underline"
          >
            카카오톡 채널 · CANGO 캔고
          </a>
          로 문의해 주세요.
        </p>
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
