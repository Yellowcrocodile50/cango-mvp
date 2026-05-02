"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ShoppingCart, CheckCircle, Clock, Send } from "lucide-react";

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
}

export default function SupplierDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalMaterials: 0,
    totalOrders: 0,
    completedOrders: 0,
    pendingDelivery: 0,
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
      setStats({ totalMaterials: materialsCount || 0, totalOrders: 0, completedOrders: 0, pendingDelivery: 0 });
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

    const buyerIds = [...new Set(orderList.map((o) => o.buyer_id).filter(Boolean))];

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

    setStats({
      totalMaterials: materialsCount || 0,
      totalOrders: ordersCount || 0,
      completedOrders: completed,
      pendingDelivery,
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

  function getStatusBadge(order: Order) {
    if (order.is_sent)
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">발송완료</Badge>;
    if (order.payment_status === "done")
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">발송대기</Badge>;
    if (order.payment_status === "pending")
      return <Badge variant="secondary">결제대기</Badge>;
    if (order.payment_status === "canceled")
      return <Badge variant="destructive">취소</Badge>;
    return <Badge variant="outline">{order.payment_status}</Badge>;
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-[#365927]">주문 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">로딩 중...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">아직 주문이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주문자</TableHead>
                  <TableHead>구분 / 학년</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>상품명</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>주문일</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.buyer_name}</TableCell>
                    <TableCell>
                      {order.user_type ? (
                        <span>
                          {order.user_type === "student" ? "학생" : "학부모"}
                          {order.grade && (
                            <span className="ml-1 text-muted-foreground">· {order.grade}</span>
                          )}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.buyer_email}</TableCell>
                    <TableCell className="text-muted-foreground">{order.buyer_phone || "-"}</TableCell>
                    <TableCell>{order.material_title}</TableCell>
                    <TableCell className="text-muted-foreground">{order.material_category}</TableCell>
                    <TableCell>{order.amount.toLocaleString()}원</TableCell>
                    <TableCell>{getStatusBadge(order)}</TableCell>
                    <TableCell>
                      {new Date(order.created_at).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right">
                      {order.payment_status === "done" && !order.is_sent && (
                        <Button
                          size="sm"
                          onClick={() => markAsSent(order.id)}
                          className="bg-[#365927] hover:bg-[#4a7a38]"
                        >
                          <Send className="mr-1 h-3 w-3" />
                          발송
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
