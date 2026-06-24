"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, Clock, Download, RefreshCw, ChevronRight } from "lucide-react";
import { isFreeCategory } from "@/data/categories";

interface Stats {
  totalMaterials: number;
  paidCount: number; // 유료 결제 완료 건수
  paidPending: number; // 유료 결제 완료 & 미발송 (상품 준비중)
  paidCompleted: number; // 유료 결제 완료 & 발송 완료
  freeDownloads: number; // 무료 자료 다운로드(결제 완료) 건수
  totalRevenue: number;
  bankPending: number;
}

const EMPTY_STATS: Stats = {
  totalMaterials: 0,
  paidCount: 0,
  paidPending: 0,
  paidCompleted: 0,
  freeDownloads: 0,
  totalRevenue: 0,
  bankPending: 0,
};

export default function SupplierDashboard() {
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: myMaterials, count: materialsCount } = await supabase
      .from("materials")
      .select("id, category", { count: "exact" })
      .eq("supplier_id", user.id)
      .eq("is_deleted", false);

    const materialIds = (myMaterials ?? []).map((m) => m.id);
    const categoryMap = new Map((myMaterials ?? []).map((m) => [m.id, m.category]));

    if (materialIds.length === 0) {
      setStats({ ...EMPTY_STATS, totalMaterials: materialsCount || 0 });
      setLoading(false);
      return;
    }

    const { data: orderRows } = await supabase
      .from("orders")
      .select("payment_status, is_sent, amount, payment_method, material_id")
      .in("material_id", materialIds);

    // 단일 패스로 통계 집계 (유료 결제 / 무료 다운로드 분리)
    let paidCount = 0;
    let paidPending = 0;
    let paidCompleted = 0;
    let freeDownloads = 0;
    let totalRevenue = 0;
    let bankPending = 0;
    for (const o of orderRows ?? []) {
      const free = isFreeCategory(categoryMap.get(o.material_id) ?? "");
      // 무료 자료는 직접 다운로드 → 입금/발송 개념 없음. 유료 주문만 입금 대기 집계
      if (!free && o.payment_method === "bank_transfer" && o.payment_status === "pending") {
        bankPending += 1;
      }
      if (o.payment_status !== "done") continue;
      if (free) {
        // 무료 다운로드는 발송 대기/정산에서 제외하고 별도 카운트
        freeDownloads += 1;
        continue;
      }
      paidCount += 1;
      totalRevenue += o.amount;
      if (o.is_sent) paidCompleted += 1;
      else paidPending += 1;
    }

    setStats({
      totalMaterials: materialsCount || 0,
      paidCount,
      paidPending,
      paidCompleted,
      freeDownloads,
      totalRevenue,
      bankPending,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const statCards = useMemo(() => [
    { title: "등록 자료", value: stats.totalMaterials, icon: Package, description: "등록된 PDF 자료 수" },
    { title: "유료 결제", value: stats.paidCount, icon: ShoppingCart, description: "유료 자료 결제 건수" },
    { title: "무료 다운로드", value: stats.freeDownloads, icon: Download, description: "무료 자료 다운로드 수" },
    { title: "발송 대기", value: stats.paidPending, icon: Clock, description: "결제 완료, 발송 필요", highlight: true },
  ], [stats]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#365927]">대시보드</h1>

      {stats.bankPending > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
          <span className="text-blue-600 font-semibold">
            💰 입금 확인 대기 {stats.bankPending}건
          </span>
          <span className="text-blue-500">카카오뱅크 3333-23-1624402 확인 후 주문 관리에서 승인해주세요.</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card
            key={card.title}
            className={card.highlight && stats.paidPending > 0 ? "border-yellow-300 bg-yellow-50/50" : ""}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-[#5a7d50]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#365927]">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 유료 결제 현황 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-base font-bold text-[#365927] flex items-center gap-2">
            🏷️ 유료 결제 현황
          </CardTitle>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-md text-[#8aab82] hover:text-[#365927] hover:bg-[#f5f9f4] transition cursor-pointer disabled:opacity-50"
            aria-label="새로고침"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </CardHeader>
        <CardContent className="pt-4">
          {/* 결제 완료 → 상품 준비중 → 발송 완료 흐름 */}
          <div className="flex items-center">
            <div className="flex-1 flex flex-col items-center gap-1 py-3">
              <span className="text-3xl font-bold text-[#365927]">{stats.paidCount}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">결제 완료</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#d6e4d3] shrink-0" />
            <div className="flex-1 flex flex-col items-center gap-1 py-3">
              <span className={`text-3xl font-bold ${stats.paidPending > 0 ? "text-amber-500" : "text-[#8aab82]"}`}>
                {stats.paidPending}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">상품 준비중</span>
            </div>
            <ChevronRight className="w-5 h-5 text-[#d6e4d3] shrink-0" />
            <div className="flex-1 flex flex-col items-center gap-1 py-3">
              <span className="text-3xl font-bold text-[#5a7d50]">{stats.paidCompleted}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">발송 완료</span>
            </div>
          </div>

          {/* 총 정산액 */}
          <div className="mt-2 pt-4 border-t flex items-center justify-between">
            <span className="text-sm text-[#5a7d50] font-medium">💰 총 정산액</span>
            <span className="text-lg font-bold text-[#365927]">
              {stats.totalRevenue.toLocaleString()}원
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 무료 자료 다운로드 (유료 결제와 분리) */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-bold text-[#365927] flex items-center gap-2">
            📥 무료 자료 다운로드
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#5a7d50] font-medium">총 다운로드</span>
            <span className="text-2xl font-bold text-[#365927]">{stats.freeDownloads}건</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            무료 자료는 구매자가 사이트에서 직접 내려받으므로 별도 발송이 필요하지 않습니다.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
