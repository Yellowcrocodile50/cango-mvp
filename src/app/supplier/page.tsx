"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, CheckCircle, Clock, RefreshCw, ChevronRight } from "lucide-react";

interface Stats {
  totalMaterials: number;
  totalOrders: number;
  completedOrders: number;
  pendingDelivery: number;
  paidOrders: number;
  totalRevenue: number;
  bankPending: number;
}

const EMPTY_STATS: Stats = {
  totalMaterials: 0,
  totalOrders: 0,
  completedOrders: 0,
  pendingDelivery: 0,
  paidOrders: 0,
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
      .select("id", { count: "exact" })
      .eq("supplier_id", user.id)
      .eq("is_deleted", false);

    const materialIds = (myMaterials ?? []).map((m) => m.id);

    if (materialIds.length === 0) {
      setStats({ ...EMPTY_STATS, totalMaterials: materialsCount || 0 });
      setLoading(false);
      return;
    }

    const { data: orderRows, count: ordersCount } = await supabase
      .from("orders")
      .select("payment_status, is_sent, amount, payment_method", { count: "exact" })
      .in("material_id", materialIds);

    // 단일 패스로 통계 집계
    let completedOrders = 0;
    let pendingDelivery = 0;
    let paidOrders = 0;
    let totalRevenue = 0;
    let bankPending = 0;
    for (const o of orderRows ?? []) {
      if (o.payment_method === "bank_transfer" && o.payment_status === "pending") {
        bankPending += 1;
      }
      if (o.payment_status !== "done") continue;
      paidOrders += 1;
      totalRevenue += o.amount;
      if (o.is_sent) completedOrders += 1;
      else pendingDelivery += 1;
    }

    setStats({
      totalMaterials: materialsCount || 0,
      totalOrders: ordersCount || 0,
      completedOrders,
      pendingDelivery,
      paidOrders,
      totalRevenue,
      bankPending,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const statCards = [
    { title: "등록 자료", value: stats.totalMaterials, icon: Package, description: "등록된 PDF 자료 수" },
    { title: "총 주문", value: stats.totalOrders, icon: ShoppingCart, description: "전체 주문 건수" },
    { title: "발송 완료", value: stats.completedOrders, icon: CheckCircle, description: "파일 발송 완료" },
    { title: "발송 대기", value: stats.pendingDelivery, icon: Clock, description: "결제 완료, 발송 필요", highlight: true },
  ];

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
            className={card.highlight && stats.pendingDelivery > 0 ? "border-yellow-300 bg-yellow-50/50" : ""}
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

      {/* 판매 현황 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-base font-bold text-[#365927] flex items-center gap-2">
            🏷️ 판매 현황
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
          {/* 총합 행 + 흐름 행 - 동일 컬럼 너비로 정렬 */}
          <div>
            {/* 총합 행 */}
            <div className="flex items-center bg-[#f5f9f4] rounded-lg py-2 text-xs text-muted-foreground mb-3">
              <span className="w-12 text-center font-medium text-[#5a7d50] shrink-0">총합</span>
              <div className="flex-1 text-center font-medium text-[#365927]">{stats.paidOrders}</div>
              <div className="w-5 shrink-0" />
              <div className="flex-1 text-center font-medium text-amber-500">{stats.pendingDelivery}</div>
              <div className="w-5 shrink-0" />
              <div className="flex-1 text-center font-medium text-[#5a7d50]">{stats.completedOrders}</div>
            </div>
            {/* 흐름 행 */}
            <div className="flex items-center">
              <div className="w-12 shrink-0" />
              <div className="flex-1 flex flex-col items-center gap-1 py-3">
                <span className="text-3xl font-bold text-[#365927]">{stats.paidOrders}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">결제 완료</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#d6e4d3] shrink-0" />
              <div className="flex-1 flex flex-col items-center gap-1 py-3">
                <span className={`text-3xl font-bold ${stats.pendingDelivery > 0 ? "text-amber-500" : "text-[#8aab82]"}`}>
                  {stats.pendingDelivery}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">상품 준비중</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#d6e4d3] shrink-0" />
              <div className="flex-1 flex flex-col items-center gap-1 py-3">
                <span className="text-3xl font-bold text-[#5a7d50]">{stats.completedOrders}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">발송 완료</span>
              </div>
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

    </div>
  );
}
