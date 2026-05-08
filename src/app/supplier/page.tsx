"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, CheckCircle, Clock, RefreshCw, ChevronRight } from "lucide-react";

interface Order {
  id: string;
  buyer_id: string | null;
  buyer_email: string;
  buyer_phone: string | null;
  buyer_name: string;
  amount: number;
  payment_status: string;
  is_sent: boolean;
  created_at: string;
  material_title: string;
  material_category: string;
  material_id: string;
  user_type: string | null;
  grade: string | null;
}

interface Stats {
  totalMaterials: number;
  totalOrders: number;
  completedOrders: number;
  pendingDelivery: number;
  paidOrders: number;
  totalRevenue: number;
}

export default function SupplierDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalMaterials: 0,
    totalOrders: 0,
    completedOrders: 0,
    pendingDelivery: 0,
    paidOrders: 0,
    totalRevenue: 0,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: myMaterials, count: materialsCount } = await supabase
      .from("materials")
      .select("id, title, category", { count: "exact" })
      .eq("supplier_id", user.id)
      .eq("is_deleted", false);

    const materialMap = new Map(
      myMaterials?.map((m) => [m.id, { title: m.title, category: m.category }]) || []
    );
    const materialIds = [...materialMap.keys()];

    if (materialIds.length === 0) {
      setStats({ totalMaterials: materialsCount || 0, totalOrders: 0, completedOrders: 0, pendingDelivery: 0, paidOrders: 0, totalRevenue: 0 });
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data: allOrders, count: ordersCount } = await supabase
      .from("orders")
      .select("*", { count: "exact" })
      .in("material_id", materialIds)
      .order("created_at", { ascending: false });

    const orderList = allOrders || [];

    const buyerIds = [...new Set(orderList.map((o) => o.buyer_id).filter((id): id is string => id !== null))];

    const { data: profiles } = buyerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, user_type, grade")
          .in("id", buyerIds)
      : { data: [] };

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, { user_type: p.user_type, grade: p.grade }])
    );

    const completed = orderList.filter((o) => o.payment_status === "done" && o.is_sent).length;
    const pendingDelivery = orderList.filter((o) => o.payment_status === "done" && !o.is_sent).length;
    const paidOrdersList = orderList.filter((o) => o.payment_status === "done");
    const paidOrders = paidOrdersList.length;
    const totalRevenue = paidOrdersList.reduce((sum, o) => sum + o.amount, 0);

    setStats({
      totalMaterials: materialsCount || 0,
      totalOrders: ordersCount || 0,
      completedOrders: completed,
      pendingDelivery,
      paidOrders,
      totalRevenue,
    });

    setOrders(
      orderList.map((o) => ({
        ...o,
        material_title: materialMap.get(o.material_id)?.title || "알 수 없음",
        material_category: materialMap.get(o.material_id)?.category || "-",
        buyer_name: o.buyer_name || o.buyer_email?.split("@")[0] || "-",
        user_type: profileMap.get(o.buyer_id)?.user_type ?? null,
        grade: profileMap.get(o.buyer_id)?.grade ?? null,
      }))
    );

    setLoading(false);
  }

  async function markAsSent(orderId: string) {
    await supabase.from("orders").update({ is_sent: true }).eq("id", orderId);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, is_sent: true } : o))
    );
    setStats((prev) => ({
      ...prev,
      completedOrders: prev.completedOrders + 1,
      pendingDelivery: prev.pendingDelivery - 1,
    }));
  }

  const statCards = [
    { title: "등록 자료", value: stats.totalMaterials, icon: Package, description: "등록된 PDF 자료 수" },
    { title: "총 주문", value: stats.totalOrders, icon: ShoppingCart, description: "전체 주문 건수" },
    { title: "발송 완료", value: stats.completedOrders, icon: CheckCircle, description: "파일 발송 완료" },
    { title: "발송 대기", value: stats.pendingDelivery, icon: Clock, description: "결제 완료, 발송 필요", highlight: true },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#365927]">대시보드</h1>

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
            className="p-1.5 rounded-md text-[#8aab82] hover:text-[#365927] hover:bg-[#f5f9f4] transition cursor-pointer"
            aria-label="새로고침"
          >
            <RefreshCw className="h-4 w-4" />
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
