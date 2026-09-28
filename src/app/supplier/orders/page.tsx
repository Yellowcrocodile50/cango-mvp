"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { isFreeCategory, getCategoryLabel } from "@/data/categories";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { TablePagination, usePagination } from "@/components/supplier/TablePagination";

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
  email_status: string | null;
  email_error: string | null;
}

// 구매자 id를 .in()에 한 번에 넣으면 URL이 길어져 Bad Request가 난다(수백 개에서 실측)
const PROFILE_CHUNK = 200;

function formatDownloadTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 처리 우선순위: 낮을수록 위로 (반송 → 입금확인 → 발송 → 영수증발행 → 완료 → 취소)
// 무료 자료는 직접 다운로드 → 발송 개념이 없으므로 '발송 대기'로 치지 않음
function actionPriority(o: Order): number {
  const free = isFreeCategory(o.material_category);
  if (o.email_status === "bounced") return 0; // 이메일 반송 — 주소 확인 후 재발송 필요
  if (!free && o.payment_status === "pending") return 1; // 입금 확인 대기
  if (!free && o.payment_status === "done" && !o.is_sent) return 2; // 발송 대기
  if (o.cash_receipt_requested && o.payment_status === "done" && !o.cash_receipt_issued)
    return 3; // 현금영수증 발행 대기
  if (o.payment_status === "canceled") return 5; // 취소 (맨 뒤)
  return 4; // 처리 완료(무료 다운로드 포함)
}

type KindFilter = "all" | "paid" | "free";

function OrdersPageInner() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  /* 한 주문(order_id)에 묶인 행이 몇 개이고 합계가 얼마인지.
     장바구니로 여러 자료를 한 번에 사면 자료 수만큼 행이 생기므로, 행 단위로 세면
     주문 1건이 3건으로 보이고 은행에 찍힌 실제 입금액과도 맞출 수 없다. */
  const orderGroups = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    for (const o of orders) {
      if (!o.order_id) continue;
      const g = m.get(o.order_id) ?? { count: 0, total: 0 };
      g.count += 1;
      g.total += o.amount;
      m.set(o.order_id, g);
    }
    return m;
  }, [orders]);

  // order_id가 있으면 주문 단위로, 없으면(구주문) 행 단위로 센다
  const countByOrder = useCallback(
    (match: (o: Order) => boolean) => {
      const ids = new Set<string>();
      let loose = 0;
      for (const o of orders) {
        if (!match(o)) continue;
        if (o.order_id) ids.add(o.order_id);
        else loose += 1;
      }
      return ids.size + loose;
    },
    [orders]
  );

  const bankPendingCount = useMemo(
    () => countByOrder((o) => o.payment_method === "bank_transfer" && o.payment_status === "pending"),
    [countByOrder]
  );

  const bouncedCount = useMemo(
    () => orders.filter((o) => o.email_status === "bounced").length,
    [orders]
  );

  const cashReceiptPendingCount = useMemo(
    () => countByOrder((o) => o.cash_receipt_requested && o.payment_status === "done" && !o.cash_receipt_issued),
    [countByOrder]
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

  // 유료 구매와 무료 다운로드는 처리할 일이 전혀 다르다(입금·발송 vs 없음). 따로 볼 수 있게 나눈다.
  // 대시보드 카드에서 ?kind=paid|free로 들어온다. 없으면 처리할 일(입금 확인·발송)이 있는 유료부터.
  const searchParams = useSearchParams();
  const [kindFilter, setKindFilter] = useState<KindFilter>(() => {
    const k = searchParams.get("kind");
    return k === "all" || k === "free" ? k : "paid";
  });
  const kindCounts = useMemo(() => {
    let free = 0;
    for (const o of orders) if (isFreeCategory(o.material_category)) free += 1;
    return { all: orders.length, paid: orders.length - free, free };
  }, [orders]);
  const filteredOrders = useMemo(
    () =>
      kindFilter === "all"
        ? sortedOrders
        : sortedOrders.filter((o) => isFreeCategory(o.material_category) === (kindFilter === "free")),
    [sortedOrders, kindFilter]
  );

  const pager = usePagination(filteredOrders);

  function toggleSort(key: SortKey) {
    pager.reset();
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

    /* 1000건씩 끊어서 전부 받는다. 상태 정렬·대기 건수 배너·묶음 합계가
       전체 주문을 기준으로 해야 하므로, 페이지 나누기는 서버가 아니라 화면에서 한다. */
    const { data: orderList, error: ordersError } = await fetchAllRows((from, to) =>
      supabase
        .from("orders")
        .select("id, order_id, depositor_name, buyer_id, buyer_email, buyer_phone, amount, payment_status, payment_method, is_sent, created_at, first_downloaded_at, material_id, cash_receipt_requested, cash_receipt_phone, cash_receipt_issued, email_status, email_error")
        .in("material_id", materialIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to)
    );
    if (ordersError) toast.error("주문 목록을 끝까지 불러오지 못했습니다. 새로고침해주세요.");

    const buyerIds = [...new Set(orderList.map((o) => o.buyer_id).filter((id): id is string => id !== null))];

    const profiles: { id: string; userid: string | null; user_type: string | null; grade: string | null }[] = [];
    for (let i = 0; i < buyerIds.length; i += PROFILE_CHUNK) {
      const { data } = await supabase
        .from("profiles")
        .select("id, userid, user_type, grade")
        .in("id", buyerIds.slice(i, i + PROFILE_CHUNK));
      profiles.push(...(data ?? []));
    }

    const profileMap = new Map(
      profiles.map((p) => [p.id, { userid: p.userid, user_type: p.user_type, grade: p.grade }])
    );

    setOrders(
      orderList.map((o) => ({
        ...o,
        material_title: materialMap.get(o.material_id)?.title || "삭제된 자료",
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

  /* 영수증 메일은 confirm-bank가 한 주문의 자료를 묶어 1통으로 보낸다.
     따라서 발송 완료 표시도 주문 단위여야 한다 — 행마다 누르게 두면
     3개짜리 주문에서 같은 메일 1통을 놓고 버튼을 3번 눌러야 한다. */
  async function markAsSent(order: Order) {
    const group = order.order_id ? orderGroups.get(order.order_id) : undefined;
    const bulk = (group?.count ?? 1) > 1;
    if (
      !window.confirm(
        bulk
          ? `이 주문에 묶인 자료 ${group!.count}건을 모두 발송 완료로 표시할까요? 발송 후에는 되돌릴 수 없습니다.`
          : "자료를 발송 완료로 표시할까요? 발송 후에는 되돌릴 수 없습니다."
      )
    )
      return;

    const query = supabase.from("orders").update({ is_sent: true });
    const { error } = order.order_id
      ? await query.eq("order_id", order.order_id)
      : await query.eq("id", order.id);
    if (error) {
      toast.error("발송 완료 처리에 실패했습니다. 다시 시도해주세요.");
      return;
    }
    setOrders((prev) =>
      prev.map((o) =>
        (order.order_id ? o.order_id === order.order_id : o.id === order.id)
          ? { ...o, is_sent: true }
          : o
      )
    );
    toast.success(bulk ? `${group!.count}건을 발송 완료로 표시했습니다.` : "발송 완료로 표시했습니다.");
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

    const body = res?.ok ? await res.json().catch(() => null) : null;

    if (res?.ok) {
      /* confirm-bank는 order_id로 묶인 행 전체를 done 처리한다.
         화면도 같은 범위를 갱신해야 한다 — 누른 행만 바꾸면 나머지가 '입금대기'로 남아
         다시 누르게 되고, 그땐 pending 행이 없어 400이 떨어져 실패로 보인다. */
      setOrders((prev) =>
        prev.map((o) =>
          o.order_id === order.order_id ? { ...o, payment_status: "done" } : o
        )
      );
      const count = orderGroups.get(order.order_id!)?.count ?? 1;
      const suffix = count > 1 ? ` (${count}건)` : "";
      // 메일 보류 주문은 상태만 바뀌므로, 발송된 줄 알고 넘어가지 않도록 명시한다
      if (body?.emailSuppressed) {
        toast.success(`입금이 확인되었습니다.${suffix} 자료 메일은 보내지 않았습니다.`);
      } else {
        toast.success(`입금이 확인되었습니다.${suffix}`);
      }
    } else {
      toast.error("입금 확인 처리에 실패했습니다. 다시 시도해주세요.");
    }
  }

  /* 현금영수증은 결제 1건에 1장이므로 주문 단위로 처리한다. */
  async function markCashReceiptIssued(order: Order) {
    if (!window.confirm("현금영수증을 발행 완료로 표시할까요?\n홈택스에서 실제로 발행하신 뒤 체크해주세요.")) return;
    const query = supabase.from("orders").update({ cash_receipt_issued: true });
    const { error } = order.order_id
      ? await query.eq("order_id", order.order_id)
      : await query.eq("id", order.id);
    if (error) {
      toast.error("발행 완료 처리에 실패했습니다. 다시 시도해주세요.");
      return;
    }
    setOrders((prev) =>
      prev.map((o) =>
        (order.order_id ? o.order_id === order.order_id : o.id === order.id)
          ? { ...o, cash_receipt_issued: true }
          : o
      )
    );
    toast.success("현금영수증 발행 완료로 표시했습니다.");
  }

  /* 표(PC)와 카드(모바일)가 같은 상태·버튼을 쓴다 — 한쪽만 고치다 어긋나지 않게 한 곳에 둔다. */
  // 비로그인(노랑) > 입금 대기(파랑, 로그인만) > 무료(초록) > 유료(기본)
  function rowTone(order: Order) {
    if (order.buyer_id === null) return "bg-yellow-100/70";
    if (order.payment_method === "bank_transfer" && order.payment_status === "pending") return "bg-blue-50/60";
    if (isFreeCategory(order.material_category)) return "bg-emerald-50/60";
    return "";
  }

  function renderCashReceipt(order: Order) {
    return (
      <>
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
      </>
    );
  }

  function renderStatus(order: Order, withCashReceipt = true) {
    const isFree = isFreeCategory(order.material_category);
    return (
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
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <OrderStatusBadge is_sent={order.is_sent} payment_status={order.payment_status} payment_method={order.payment_method} email_status={order.email_status} />
              {order.payment_method === "bank_transfer" && order.payment_status === "done" && (
                <span className="text-xs text-[#8aab82] whitespace-nowrap">
                  입금완료 {formatDownloadTime(order.created_at)}
                </span>
              )}
            </div>
            {order.email_status === "bounced" && order.email_error && (
              <p className="text-xs text-red-600 max-w-[22rem] leading-snug">
                {order.email_error}
              </p>
            )}
          </div>
        )}
        {withCashReceipt && renderCashReceipt(order)}
      </div>
    );
  }

  function renderActions(order: Order, mobile = false) {
    const isFree = isFreeCategory(order.material_category);
    // 모바일은 손가락으로 누르니 버튼을 카드 폭만큼 넓고 높게
    const btn = mobile ? "flex-1 h-10" : "";
    return (
      <div className={mobile ? "flex gap-2" : "flex justify-end gap-2"}>
        {!isFree && order.payment_method === "bank_transfer" && order.payment_status === "pending" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => confirmBankTransfer(order)}
            className={`border-[#365927] text-[#365927] hover:bg-[#eaf2e8] ${btn}`}
          >
            <CheckCircle className="mr-1 h-3 w-3" />
            입금확인
          </Button>
        )}
        {!isFree && order.payment_status === "done" && !order.is_sent && (
          <Button
            size="sm"
            onClick={() => markAsSent(order)}
            className={`bg-[#365927] hover:bg-[#4a7a38] ${btn}`}
          >
            <Send className="mr-1 h-3 w-3" />
            발송완료
          </Button>
        )}
        {order.cash_receipt_requested && order.payment_status === "done" && !order.cash_receipt_issued && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => markCashReceiptIssued(order)}
            className={`border-emerald-600 text-emerald-700 hover:bg-emerald-50 ${btn}`}
          >
            <Receipt className="mr-1 h-3 w-3" />
            영수증발행
          </Button>
        )}
      </div>
    );
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

      {bouncedCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <span className="text-red-700 font-semibold">
            📮 이메일 반송 {bouncedCount}건
          </span>
          <span className="text-red-600">받는 주소가 없거나 잘못된 건입니다. 사유를 확인하고 주소를 정정한 뒤 다시 보내주세요.</span>
        </div>
      )}

      {bankPendingCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
          <span className="text-blue-600 font-semibold">
            💰 입금 확인 대기 {bankPendingCount}건
          </span>
          <span className="text-blue-500">카카오뱅크 3333-23-1624402 입금 확인 후 아래에서 승인해주세요.</span>
        </div>
      )}

      {cashReceiptPendingCount > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm">
          <span className="text-emerald-700 font-semibold">
            🧾 현금영수증 발행 대기 {cashReceiptPendingCount}건
          </span>
          <span className="text-emerald-600">입금 확인된 주문 중 현금영수증 신청 건입니다. 홈택스에서 발행해주세요.</span>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg">주문 목록</CardTitle>
          <div className="inline-flex rounded-md border border-[#d6e4d3] overflow-hidden">
            {([
              { v: "all", label: "전체" },
              { v: "paid", label: "유료 구매" },
              { v: "free", label: "무료 다운로드" },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                onClick={() => { setKindFilter(opt.v); pager.reset(); }}
                aria-pressed={kindFilter === opt.v}
                className={`px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  kindFilter === opt.v
                    ? "bg-[#365927] text-white"
                    : "bg-white text-[#5a7d50] hover:bg-[#eef5ec]"
                }`}
              >
                {opt.label} {kindCounts[opt.v].toLocaleString()}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">로딩 중...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">아직 주문이 없습니다.</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {kindFilter === "free" ? "무료 다운로드 내역이 없습니다." : "유료 구매 내역이 없습니다."}
            </p>
          ) : (
            <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300" />
                무료 자료
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-white border border-gray-300" />
                유료 자료 (로그인)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300" />
                비로그인 주문
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 border border-blue-300" />
                입금 확인 대기
              </span>
            </div>
            {/* 모바일: 표 헤더(정렬)가 안 보이므로 정렬은 선택 상자로 */}
            <div className="md:hidden mb-3">
              <select
                value={`${sortKey}-${sortDir}`}
                onChange={(e) => {
                  const [k, d] = e.target.value.split("-") as [SortKey, "asc" | "desc"];
                  setSortKey(k);
                  setSortDir(d);
                  pager.reset();
                }}
                aria-label="정렬"
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="status-asc">처리 필요 먼저</option>
                <option value="created_at-desc">최신순</option>
                <option value="created_at-asc">오래된순</option>
                <option value="amount-desc">금액 높은순</option>
              </select>
            </div>

            {/* 모바일: 주문 한 건 = 카드 한 장. 처리에 필요한 것(상태·금액·입금자·이메일·버튼)을 위로,
                문제가 생겼을 때만 보는 것(아이디·전화번호·현금영수증 등)은 아래 작은 글씨로 */}
            <div className="md:hidden space-y-3">
              {pager.pageItems.map((order) => {
                const isFree = isFreeCategory(order.material_category);
                const group = order.order_id ? orderGroups.get(order.order_id) : undefined;
                const tone = rowTone(order);
                return (
                  <div key={order.id} className={`rounded-lg border p-3 space-y-2 ${tone || "bg-white"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm leading-snug break-keep">{order.material_title}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                        {formatDownloadTime(order.created_at)}
                      </span>
                    </div>
                    {renderStatus(order, false)}
                    <div className="text-sm">
                      <span className="font-semibold text-[#365927]">
                        {isFree ? "무료" : `${order.amount.toLocaleString()}원`}
                      </span>
                      {group && group.count > 1 && (
                        <span className="text-xs text-[#365927]"> · 묶음 {group.count}건 합계 {group.total.toLocaleString()}원</span>
                      )}
                    </div>
                    {order.payment_method === "bank_transfer" && (
                      <p className="text-sm">
                        {order.depositor_name
                          ? <span className="text-blue-600">입금자: {order.depositor_name}</span>
                          : <span className="text-[#8aab82]">입금자명 미입력</span>}
                      </p>
                    )}
                    <p className="text-sm break-all">{order.buyer_email}</p>
                    {renderActions(order, true)}
                    <div className="pt-2 border-t border-black/5 text-xs text-muted-foreground space-y-1">
                      <p>
                        {[
                          order.buyer_userid || "비로그인",
                          order.user_type ? `${order.user_type === "student" ? "학생" : "학부모"}${order.grade ? ` · ${order.grade}` : ""}` : null,
                          order.buyer_phone,
                          order.material_category !== "-" ? getCategoryLabel(order.material_category) : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                      {renderCashReceipt(order)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block">
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
                {pager.pageItems.map((order) => {
                  const isFree = isFreeCategory(order.material_category);
                  const group = order.order_id ? orderGroups.get(order.order_id) : undefined;
                  const rowClass = rowTone(order);
                  return (
                    <TableRow key={order.id} className={rowClass}>
                      <TableCell className="font-medium">{order.material_title}</TableCell>
                      <TableCell className="text-muted-foreground">{order.material_category !== "-" ? getCategoryLabel(order.material_category) : "-"}</TableCell>
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
                      <TableCell>
                        {isFree ? "무료" : `${order.amount.toLocaleString()}원`}
                        {/* 묶음 주문이면 실제 입금액(합계)을 같이 보여준다.
                            은행에 찍힌 금액과 대조할 수 있어야 입금 확인이 가능하다. */}
                        {group && group.count > 1 && (
                          <div className="text-xs text-[#365927] whitespace-nowrap mt-0.5">
                            묶음 {group.count}건 · 합계 {group.total.toLocaleString()}원
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderStatus(order)}
                      </TableCell>
                      <TableCell>
                        {new Date(order.created_at).toLocaleDateString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderActions(order)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            <TablePagination {...pager.props} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// useSearchParams는 Suspense 경계가 있어야 빌드된다
export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersPageInner />
    </Suspense>
  );
}
