"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Send, CheckCircle } from "lucide-react";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
import { isFreeCategory } from "@/data/categories";

interface Order {
  id: string;
  order_id: string | null;
  depositor_name: string | null;
  buyer_id: string | null;
  buyer_email: string;
  buyer_phone: string | null;
  amount: number;
  payment_status: string;
  payment_method: string;
  is_sent: boolean;
  created_at: string;
  first_downloaded_at: string | null;
  material_title: string;
  material_category: string;
  material_id: string;
  user_type: string | null;
  grade: string | null;
  buyer_userid: string | null;
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

  const fetchOrders = useCallback(async () => {
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
      .select("id, order_id, depositor_name, buyer_id, buyer_email, buyer_phone, amount, payment_status, payment_method, is_sent, created_at, first_downloaded_at, material_id")
      .in("material_id", materialIds)
      .order("created_at", { ascending: false });

    const orderList = rawOrders || [];
    const buyerIds = [...new Set(orderList.map((o) => o.buyer_id).filter((id): id is string => id !== null))];

    const { data: profiles } = buyerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, userid, user_type, grade")
          .in("id", buyerIds)
      : { data: [] };

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, { userid: p.userid, user_type: p.user_type, grade: p.grade }])
    );

    setOrders(
      orderList.map((o) => ({
        ...o,
        material_title: materialMap.get(o.material_id)?.title || "알 수 없음",
        material_category: materialMap.get(o.material_id)?.category || "-",
        buyer_userid: profileMap.get(o.buyer_id)?.userid ?? null,
        user_type: profileMap.get(o.buyer_id)?.user_type ?? null,
        grade: profileMap.get(o.buyer_id)?.grade ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders();
  }, [fetchOrders]);

  async function markAsSent(orderId: string) {
    await supabase.from("orders").update({ is_sent: true }).eq("id", orderId);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, is_sent: true } : o))
    );
  }

  async function confirmBankTransfer(order: Order) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !order.order_id) return;

    const res = await fetch("/api/confirm-bank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ orderId: order.order_id }),
    });

    if (res.ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, payment_status: "done" } : o))
      );
    }
  }


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#365927]">주문 관리</h1>

      {orders.filter(o => o.payment_method === "bank_transfer" && o.payment_status === "pending").length > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
          <span className="text-blue-600 font-semibold">
            💰 입금 확인 대기 {orders.filter(o => o.payment_method === "bank_transfer" && o.payment_status === "pending").length}건
          </span>
          <span className="text-blue-500">카카오뱅크 3333-23-1624402 입금 확인 후 아래에서 승인해주세요.</span>
        </div>
      )}

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
                  <TableHead>아이디</TableHead>
                  <TableHead>이메일</TableHead>
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
                    <TableRow key={order.id} className={order.payment_method === "bank_transfer" && order.payment_status === "pending" ? "bg-blue-50/50" : ""}>
                      <TableCell className="font-medium">{order.material_title}</TableCell>
                      <TableCell className="text-muted-foreground">{order.material_category}</TableCell>
                      <TableCell>
                        <div>{order.buyer_userid || "-"}</div>
                        {order.payment_method === "bank_transfer" && (
                          <div className="text-xs mt-0.5">
                            {order.depositor_name
                              ? <span className="text-blue-600">입금자: {order.depositor_name}</span>
                              : <span className="text-[#8aab82]">입금자명 미입력</span>
                            }
                          </div>
                        )}
                      </TableCell>
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
                          <OrderStatusBadge is_sent={order.is_sent} payment_status={order.payment_status} payment_method={order.payment_method} />
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(order.created_at).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!isFree && order.payment_method === "bank_transfer" && order.payment_status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => confirmBankTransfer(order)}
                              className="border-[#365927] text-[#365927] hover:bg-[#eaf2e8]"
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              입금확인
                            </Button>
                          )}
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
                        </div>
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
