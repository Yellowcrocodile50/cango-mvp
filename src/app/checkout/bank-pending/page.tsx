"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BANK_ACCOUNT } from "@/lib/companyInfo";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";
import { BANK_ORDER_KEY, type BankOrderStash } from "@/lib/bankOrder";
import { toast } from "sonner";

function BankPendingContent() {
  const searchParams = useSearchParams();
  const { removeItems } = useCart();
  const orderId = searchParams.get("orderId") ?? "";
  const amount = Number(searchParams.get("amount") || 0);
  const cashReceiptRequested = searchParams.get("receipt") === "1";

  // 체크아웃에서 넘어온 주문 데이터(아직 DB에 미생성). orderId가 일치하면 "생성 모드".
  const [stash, setStash] = useState<BankOrderStash | null>(() => {
    if (typeof window === "undefined" || !orderId) return null;
    try {
      const raw = sessionStorage.getItem(BANK_ORDER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as BankOrderStash;
      return parsed.orderId === orderId ? parsed : null;
    } catch {
      return null;
    }
  });
  const [depositorName, setDepositorName] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transferred, setTransferred] = useState(false);
  const [copied, setCopied] = useState(false);

  const isCreateMode = stash !== null;

  // 뷰 모드(이미 생성된 주문)에서 입금자명을 서버에 저장
  const saveDepositorRemote = async (): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/set-depositor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ orderId, depositorName }),
    });
    return res.ok;
  };

  const handleSave = async () => {
    if (!depositorName.trim()) {
      toast.error("입금자명을 입력해주세요.");
      return;
    }
    if (!orderId) {
      toast.error("주문 정보가 올바르지 않습니다.");
      return;
    }
    // 생성 모드에서는 아직 주문 레코드가 없으므로 입력값만 확정한다.
    if (isCreateMode) {
      setSaved(true);
      toast.success("입금자명이 저장되었습니다.");
      return;
    }
    setSaving(true);
    const ok = await saveDepositorRemote();
    setSaving(false);
    if (ok) {
      setSaved(true);
      toast.success("입금자명이 저장되었습니다.");
    } else {
      toast.error("저장에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const copyAccountNumber = async () => {
    await navigator.clipboard.writeText(BANK_ACCOUNT.number.replace(/-/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTransfer = async () => {
    if (!depositorName.trim()) {
      toast.error("입금자명을 입력해주세요. 입금 확인에 꼭 필요합니다.");
      return;
    }
    if (!orderId) {
      toast.error("주문 정보가 올바르지 않습니다.");
      return;
    }

    setSaving(true);

    if (isCreateMode && stash) {
      // 입금 완료 시점에 비로소 주문 레코드를 생성한다.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSaving(false);
        toast.error("세션이 만료되었습니다. 다시 로그인해주세요.");
        return;
      }
      const rowsToInsert = stash.rows.map((r) => ({
        ...r,
        buyer_id: user.id,
        depositor_name: depositorName.trim(),
      }));
      const { error } = await supabase.from("orders").insert(rowsToInsert);
      if (error) {
        setSaving(false);
        toast.error("주문 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
        return;
      }
      removeItems(stash.materialIds);
      sessionStorage.removeItem(BANK_ORDER_KEY);
      setStash(null);
    } else if (!saved) {
      // 뷰 모드: 아직 저장 안 된 입금자명만 갱신
      const ok = await saveDepositorRemote();
      if (!ok) {
        setSaving(false);
        toast.error("저장에 실패했습니다. 다시 시도해주세요.");
        return;
      }
    }

    setSaving(false);
    setTransferred(true);
  };

  // 입금 완료 후: 마무리 화면 (안내 멘트 + 마이페이지/홈 버튼)
  if (transferred) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-16">
        <div className="w-16 h-16 bg-[#eaf2e8] rounded-full flex items-center justify-center text-3xl mx-auto mb-6 text-[#365927] font-bold">
          ✓
        </div>
        <h1 className="text-2xl font-bold text-center mb-3 text-[#365927]">
          입금 완료 접수되었습니다
        </h1>
        <p className="text-center text-[#5a7d50] mb-2">
          입금 내역을 확인한 후 등록하신 이메일로 자료를 보내드리겠습니다.
        </p>
        <p className="text-center text-sm text-[#8aab82] mb-10">
          발송 상태는 마이페이지에서 언제든 확인할 수 있습니다.
        </p>
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
        <p className="text-2xl font-bold text-[#1a2e16] font-mono tracking-wider mb-2">
          {BANK_ACCOUNT.number}
        </p>
        <button
          onClick={copyAccountNumber}
          className="text-xs text-[#365927] bg-white border border-[#b8d9b4] px-3 py-1 rounded-full hover:bg-[#d6edcf] transition cursor-pointer mb-2"
        >
          {copied ? "✓ 복사됨" : "계좌번호 복사"}
        </button>
        <p className="text-sm text-[#5a7d50]">예금주: {BANK_ACCOUNT.holder}</p>
      </div>

      {/* 입금 금액 */}
      {amount > 0 && (
        <div className="flex justify-between items-center bg-white border border-[#d6e4d3] rounded-lg px-5 py-4 mb-6">
          <span className="text-[#5a7d50] font-medium">입금 금액</span>
          <span className="text-xl font-bold text-[#365927]">{amount.toLocaleString()}원</span>
        </div>
      )}

      {/* 현금영수증 신청 접수 안내 */}
      {cashReceiptRequested && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-6 text-sm">
          <span className="text-base leading-none">🧾</span>
          <p className="text-emerald-700">
            <strong>현금영수증 신청이 접수되었습니다.</strong> 입금 확인 후 소득공제용으로 발행해 드립니다.
          </p>
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
      <div className="space-y-3 text-sm text-[#5a7d50] bg-[#f5f9f4] rounded-lg p-4 mb-6">
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

      {/* 입금 완료 버튼 */}
      <button
        onClick={handleTransfer}
        disabled={saving}
        className="w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "처리 중..." : "입금 완료했어요"}
      </button>
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
