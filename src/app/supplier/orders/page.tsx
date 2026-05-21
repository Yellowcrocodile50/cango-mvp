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
import { Send } from "lucide-react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { isFreeCategory } from "@/data/categories";

interface Order {
  id: string;
  buyer_id: string | null;
  buyer_email: string;
  buyer_phone: string | null;
  amount: number;
  payment_status: string;
  is_sent: boolean;
  created_at: string;
  first_downloaded_at: string | null;
  material_title: string;
  material_category: string;
  material_id: string;
  user_type: string | null;
  grade: string | null;
}

function formatDownloadTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: myMaterials } = await supabase
      .from("materials")
      .select("id, title, category")
      .eq("supplier_id", user.id);

    const materialMap = new Map(
      myMaterials?.map((m) => [m.id, { title: m.title, category: m.category }]) || []
    );
    const materialIds = [...materialMap.keys()];

    if (materialIds.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data: rawOrders } = await supabase
      .from("orders")
      .select("*")
      .in("material_id", materialIds)
      .order("created_at", { ascending: false });

    const orderList = rawOrders || [];
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

    setOrders(
      orderList.map((o) => ({
        ...o,
        material_title: materialMap.get(o.material_id)?.title || "알 수 없음",
        material_category: materialMap.get(o.material_id)?.category || "-",
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
  }


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#365927]">주문 관리</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">전체 주문 목록</CardTitle>
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
                  <TableHead>자료명</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead>구매자</TableHead>
                  <TableHead>구분 / 학년</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>주문일</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const isFree = isFreeCategory(order.material_category);
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.material_title}</TableCell>
                      <TableCell className="text-muted-foreground">{order.material_category}</TableCell>
                      <TableCell>{order.buyer_email}</TableCell>
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
                      <TableCell>{order.buyer_phone || "-"}</TableCell>
                      <TableCell>{isFree ? "무료" : `${order.amount.toLocaleString()}원`}</TableCell>
                      <TableCell>
                        {isFree ? (
                          order.first_downloaded_at ? (
                            <span className="inline-block text-xs font-medium text-[#365927] bg-[#eaf2e8] px-2 py-1 rounded-md whitespace-nowrap">
                              다운로드 {formatDownloadTime(order.first_downloaded_at)}
                            </span>
                          ) : (
                            <span className="inline-block text-xs text-[#8aab82] bg-[#f5f9f4] px-2 py-1 rounded-md whitespace-nowrap">
                              미다운로드
                            </span>
                          )
                        ) : (
                          <OrderStatusBadge is_sent={order.is_sent} payment_status={order.payment_status} />
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(order.created_at).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isFree && order.payment_status === "done" && !order.is_sent && (
                          <Button
                            size="sm"
                            onClick={() => markAsSent(order.id)}
                            className="bg-[#365927] hover:bg-[#4a7a38]"
                          >
                            <Send className="mr-1 h-3 w-3" />
                            발송완료
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
