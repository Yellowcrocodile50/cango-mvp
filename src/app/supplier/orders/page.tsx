"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Send, CheckCircle, RefreshCw, Receipt } from "lucide-react";
import { toast } from "sonner";
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
  cash_receipt_requested: boolean;
  cash_receipt_phone: string | null;
  cash_receipt_issued: boolean;
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

// 처리 우선순위: 낮을수록 위로 (입금확인 → 발송 → 영수증발행 → 완료 → 취소)
// 무료 자료는 직접 다운로드 → 발송 개념이 없으므로 '발송 대기'로 치지 않음
function actionPriority(o: Order): number {
  const free = isFreeCategory(o.material_category);
  if (!free && o.payment_status === "pending") return 0; // 입금 확인 대기
  if (!free && o.payment_status === "done" && !o.is_sent) return 1; // 발송 대기
  if (o.cash_receipt_requested && o.payment_status === "done" && !o.cash_receipt_issued)
    return 2; // 현금영수증 발행 대기
  if (o.payment_status === "canceled") return 4; // 취소 (맨 뒤)
  return 3; // 처리 완료(무료 다운로드 포함)
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const bankPendingCount = useMemo(
    () => orders.filter((o) => o.payment_method === "bank_transfer" && o.payment_status === "pending").length,
    [orders]
  );

  const cashReceiptPendingCount = useMemo(
    () => orders.filter((o) => o.cash_receipt_requested && o.payment_status === "done" && !o.cash_receipt_issued).length,
    [orders]
  );

  type SortKey = "created_at" | "amount" | "status";
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedOrders = useMemo(() => {
    const arr = [...orders];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "status") cmp = actionPriority(a) - actionPriority(b);
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      const primary = sortDir === "asc" ? cmp : -cmp;
      if (primary !== 0 || sortKey === "created_at") return primary;
      // 동순위 tie-break: 최신 주문 먼저
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return arr;
  }, [orders, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // 상태는 '처리 필요 먼저'(asc), 나머지는 큰 값/최신 먼저(desc)
      setSortDir(key === "status" ? "asc" : "desc");
    }
  }

  const sortArrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

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
      .select("id, order_id, depositor_name, buyer_id, buyer_email, buyer_phone, amount, payment_status, payment_method, is_sent, created_at, first_downloaded_at, material_id, cash_receipt_requested, cash_receipt_phone, cash_receipt_issued")
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
    if (!window.confirm("자료를 발송 완료로 표시할까요? 발송 후에는 되돌릴 수 없습니다.")) return;
    const { error } = await supabase.from("orders").update({ is_sent: true }).eq("id", orderId);
    if (error) {
      toast.error("발송 완료 처리에 실패했습니다. 다시 시도해주세요.");
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, is_sent: true } : o))
    );
    toast.success("발송 완료로 표시했습니다.");
  }

  async function confirmBankTransfer(order: Order) {
    if (!window.confirm(`실제 입금을 확인하셨나요?\n입금확인 시 결제 완료 처리되어 자료 발송 단계로 넘어갑니다.`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !order.order_id) {
      toast.error("세션이 만료되었습니다. 새로고침 후 다시 시도해주세요.");
      return;
    }

    const res = await fetch("/api/confirm-bank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ orderId: order.order_id }),
    }).catch(() => null);

    if (res?.ok) {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, payment_status: "done" } : o))
      );
      toast.success("입금이 확인되었습니다.");
    } else {
      toast.error("입금 확인 처리에 실패했습니다. 다시 시도해주세요.");
    }
  }

  async function markCashReceiptIssued(orderId: string) {
    if (!window.confirm("현금영수증을 발행 완료로 표시할까요?\n홈택스에서 실제로 발행하신 뒤 체크해주세요.")) return;
    const { error } = await supabase.from("orders").update({ cash_receipt_issued: true }).eq("id", orderId);
    if (error) {
      toast.error("발행 완료 처리에 실패했습니다. 다시 시도해주세요.");
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, cash_receipt_issued: true } : o))
    );
    toast.success("현금영수증 발행 완료로 표시했습니다.");
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#365927]">주문 관리</h1>
        <button
          onClick={() => { setLoading(true); fetchOrders(); }}
          disabled={loading}
          className="p-1.5 rounded-md text-[#8aab82] hover:text-[#365927] hover:bg-[#f5f9f4] transition cursor-pointer disabled:opacity-50"
          aria-label="새로고침"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {bankPendingCount > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
          <span className="text-blue-600 font-semibold">
            💰 입금 확인 대기 {bankPendingCount}건
          </span>
          <span className="text-blue-500">카카오뱅크 3333-23-1624402 입금 확인 후 아래에서 승인해주세요.</span>
        </div>
      )}

      {cashReceiptPendingCount > 0 && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm">
          <span className="text-emerald-700 font-semibold">
            🧾 현금영수증 발행 대기 {cashReceiptPendingCount}건
          </span>
          <span className="text-emerald-600">입금 확인된 주문 중 현금영수증 신청 건입니다. 홈택스에서 발행해주세요.</span>
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
                  <TableHead className="w-40">이메일</TableHead>
                  <TableHead>구분 / 학년</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead
                    className="cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("amount")}
                  >
                    금액{sortArrow("amount")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("status")}
                  >
                    상태{sortArrow("status")}
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort("created_at")}
                  >
                    주문일{sortArrow("created_at")}
                  </TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOrders.map((order) => {
                  const isFree = isFreeCategory(order.material_category);
                  return (
                    <TableRow key={order.id} className={order.payment_method === "bank_transfer" && order.payment_status === "pending" ? "bg-blue-50/50" : ""}>
                      <TableCell className="font-medium">{order.material_title}</TableCell>
                      <TableCell className="text-muted-foreground">{order.material_category}</TableCell>
                      <TableCell>
                        <div>{order.buyer_userid || "-"}</div>
                        {order.payment_method === "bank_transfer" && (
                          <div className="text-xs mt-0.5 space-y-0.5">
                            {order.depositor_name
                              ? <span className="text-blue-600">입금자: {order.depositor_name}</span>
                              : <span className="text-[#8aab82]">입금자명 미입력</span>
                            }
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate" title={order.buyer_email}>{order.buyer_email}</TableCell>
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
                        <div className="space-y-1">
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
                          {order.cash_receipt_requested && (
                            <div>
                              {order.cash_receipt_issued ? (
                                <span className="inline-block text-xs font-medium text-[#8aab82] bg-[#f5f9f4] border border-[#d6e4d3] px-2 py-0.5 rounded-md whitespace-nowrap">
                                  🧾 현금영수증 발행완료
                                </span>
                              ) : (
                                <span className="inline-block text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                                  🧾 현금영수증 {order.cash_receipt_phone || "번호 미입력"}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
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
                          {order.cash_receipt_requested && order.payment_status === "done" && !order.cash_receipt_issued && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markCashReceiptIssued(order.id)}
                              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                            >
                              <Receipt className="mr-1 h-3 w-3" />
                              영수증발행
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
