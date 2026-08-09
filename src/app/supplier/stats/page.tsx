"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { isFreeCategory } from "@/data/categories";

type Tab = "amount" | "count";

interface OrderRow {
  amount: number;
  created_at: string;
  material_id: string;
  buyer_id: string | null;
}

interface DailyEntry {
  day: string;
  paidAmount: number;
  paidCount: number;
  freeCount: number;
  loggedInPaidCount: number;
  guestPaidCount: number;
}

/** ISO 시각 → KST 달력 날짜(YYYY-MM-DD) */
function kstDateKey(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** n일 전(KST) 날짜. 브라우저 타임존과 무관하게 항상 KST 기준 */
function kstDaysAgo(n: number): string {
  return kstDateKey(new Date(Date.now() - n * 86400000).toISOString());
}

/** 소수점 이하 불필요한 0 제거: 2 → "2", 1.5 → "1.5", 1.25 → "1.25" */
function trimZeros(v: number): string {
  return String(Number(v.toFixed(2)));
}

/**
 * 축 눈금용 축약 표기.
 * 반올림하면 서로 다른 눈금이 같은 라벨이 되므로(15,000과 20,000이 둘 다 "2만")
 * 소수점을 살린다.
 */
function formatAmount(n: number): string {
  if (n === 0) return "0";
  if (n >= 100000000) return `${trimZeros(n / 100000000)}억`;
  if (n >= 10000) return `${trimZeros(n / 10000)}만`;
  if (n >= 1000) return `${trimZeros(n / 1000)}천`;
  return n.toLocaleString();
}

function niceMax(n: number): number {
  if (n <= 1) return 1;
  const order = Math.pow(10, Math.floor(Math.log10(n)));
  const normalized = n / order;
  let nice: number;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  return nice * order;
}

/**
 * 판매수량(건수) y축 상한. 눈금 간격을 보기 좋은 정수로 잡고 ×4 한다.
 * 건수는 값이 작아서, 그냥 niceMax를 쓰면 눈금이 [0,0,1,1,1]처럼 겹쳐
 * 라벨이 반복되고 React key까지 중복된다.
 */
function countAxisMax(n: number): number {
  const need = Math.max(1, Math.ceil(n / 4)); // 필요한 최소 눈금 간격
  const order = Math.pow(10, Math.floor(Math.log10(need)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    const step = Math.round(m * order);
    if (step >= need) return step * 4;
  }
  return order * 40;
}

/** 결제금액 y축 상한. 주문이 하나도 없을 때 눈금이 겹치지 않도록 최소 4로 막아둔다. */
function amountAxisMax(n: number): number {
  return Math.max(niceMax(n), 4);
}

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>("amount");

  const todayKst = useMemo(() => kstDaysAgo(0), []);

  // 기본 조회 기간은 전체 기간(첫 주문일 ~ 오늘). 첫 주문일은 아래에서 조회해 채운다.
  // 주문이 없거나 조회 실패 시에는 최근 30일로 남는다.
  const [startDate, setStartDate] = useState(() => kstDaysAgo(29));
  const [endDate, setEndDate] = useState(todayKst);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [materialIds, setMaterialIds] = useState<string[] | null>(null);
  const [freeMaterialIds, setFreeMaterialIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // materials는 mount 시 1회만 조회 (날짜 변경 시 재조회 방지)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMaterialIds([]);
        setLoading(false);
        return;
      }

      const { data: myMaterials } = await supabase
        .from("materials")
        .select("id, category")
        .eq("supplier_id", user.id);

      const materials = myMaterials ?? [];
      const ids = materials.map((m) => m.id);

      // 전체 기간을 기본값으로 쓰기 위해 첫 주문일을 찾는다.
      // setStartDate와 setMaterialIds가 같이 배치되므로 orders는 한 번만 조회된다.
      if (ids.length > 0) {
        const { data: firstOrder } = await supabase
          .from("orders")
          .select("created_at")
          .in("material_id", ids)
          .eq("payment_status", "done")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (firstOrder?.created_at) setStartDate(kstDateKey(firstOrder.created_at));
      }

      setFreeMaterialIds(
        new Set(materials.filter((m) => isFreeCategory(m.category)).map((m) => m.id))
      );
      setMaterialIds(ids);
    })();
  }, []);

  // orders는 materials 로드 후 + 날짜 변경 시 조회
  useEffect(() => {
    if (materialIds === null) return;

    (async () => {
      setLoading(true);

      if (materialIds.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const startISO = new Date(`${startDate}T00:00:00+09:00`).toISOString();
      const endISO = new Date(`${endDate}T23:59:59+09:00`).toISOString();

      const { data: rawOrders } = await supabase
        .from("orders")
        .select("amount, created_at, material_id, buyer_id")
        .in("material_id", materialIds)
        .eq("payment_status", "done")
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      setOrders(rawOrders ?? []);
      setLoading(false);
    })();
  }, [materialIds, startDate, endDate]);

  const dailyData: DailyEntry[] = useMemo(() => {
    // 날짜 칸은 KST 기준으로 만든다. 로컬 시각으로 만들면 브라우저 타임존이
    // KST가 아닐 때 kstDateKey와 하루씩 어긋나 그 날 주문이 통째로 빠진다.
    const days: string[] = [];
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const last = new Date(`${endDate}T00:00:00Z`);
    while (cursor <= last) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const map = new Map<string, DailyEntry>();
    for (const day of days) {
      map.set(day, { day, paidAmount: 0, paidCount: 0, freeCount: 0, loggedInPaidCount: 0, guestPaidCount: 0 });
    }

    for (const o of orders) {
      const key = kstDateKey(o.created_at);
      const entry = map.get(key);
      if (!entry) continue;
      if (freeMaterialIds.has(o.material_id)) {
        entry.freeCount += 1;
      } else {
        entry.paidAmount += o.amount;
        entry.paidCount += 1;
        if (o.buyer_id) {
          entry.loggedInPaidCount += 1;
        } else {
          entry.guestPaidCount += 1;
        }
      }
    }

    return days.map((d) => map.get(d)!);
  }, [orders, freeMaterialIds, startDate, endDate]);

  const totals = useMemo(() => {
    return dailyData.reduce(
      (acc, d) => ({
        paidAmount: acc.paidAmount + d.paidAmount,
        paidCount: acc.paidCount + d.paidCount,
        freeCount: acc.freeCount + d.freeCount,
        loggedInPaidCount: acc.loggedInPaidCount + d.loggedInPaidCount,
        guestPaidCount: acc.guestPaidCount + d.guestPaidCount,
      }),
      { paidAmount: 0, paidCount: 0, freeCount: 0, loggedInPaidCount: 0, guestPaidCount: 0 }
    );
  }, [dailyData]);

  const rawMax = useMemo(() => {
    if (tab === "amount") {
      return Math.max(0, ...dailyData.map((d) => d.paidAmount));
    }
    return Math.max(0, ...dailyData.flatMap((d) => [d.loggedInPaidCount, d.guestPaidCount, d.freeCount]));
  }, [tab, dailyData]);

  const yMax = tab === "count" ? countAxisMax(rawMax) : amountAxisMax(rawMax);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(yMax * r));

  const showXLabel = (idx: number, len: number) => {
    if (len <= 31) return true;
    if (len <= 62) return idx % 2 === 0 || idx === len - 1;
    if (len <= 100) return idx % 5 === 0 || idx === len - 1;
    return idx % 10 === 0 || idx === len - 1;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#365927]">주문 통계</h1>

      <Card>
        <CardHeader className="space-y-4 pb-4 border-b">
          <div className="inline-flex bg-[#f5f9f4] rounded-lg p-1 gap-1 w-fit">
            <button
              onClick={() => setTab("amount")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
                tab === "amount" ? "bg-[#365927] text-white" : "text-[#5a7d50] hover:text-[#365927]"
              }`}
            >
              결제금액
            </button>
            <button
              onClick={() => setTab("count")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition cursor-pointer ${
                tab === "count" ? "bg-[#365927] text-white" : "text-[#5a7d50] hover:text-[#365927]"
              }`}
            >
              판매수량
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-sm">
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 px-3 border border-[#d6e4d3] rounded-md bg-white text-[#365927] focus:outline-none focus:ring-2 focus:ring-[#365927]"
            />
            <span className="text-[#8aab82]">~</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={todayKst}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 px-3 border border-[#d6e4d3] rounded-md bg-white text-[#365927] focus:outline-none focus:ring-2 focus:ring-[#365927]"
            />
            {/* 대시보드 '총 정산액'은 전체 기간이라 값이 다를 수 있어 기간 한정임을 명시 */}
            <span className="ml-auto text-xs text-[#5a7d50]">
              {tab === "amount"
                ? `선택 기간 합계 ${totals.paidAmount.toLocaleString()}원`
                : `선택 기간 · 유료 ${totals.paidCount}건 (로그인 ${totals.loggedInPaidCount} / 비로그인 ${totals.guestPaidCount}) · 무료 ${totals.freeCount}건`}
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-4">
          <div className="flex justify-end gap-4 mb-3 text-xs">
            {tab === "amount" ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-[#365927]" />
                <span className="text-[#5a7d50]">유료 결제금액</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-[#365927]" />
                  <span className="text-[#5a7d50]">로그인+유료</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />
                  <span className="text-[#5a7d50]">비로그인+유료</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm bg-[#c8d8be]" />
                  <span className="text-[#5a7d50]">무료</span>
                </div>
              </>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-20 text-center">로딩 중...</p>
          ) : (
            <div className="flex">
              <div className="flex flex-col justify-between h-64 pr-2 pb-[6px] text-xs text-[#8aab82] text-right shrink-0">
                {[...yTicks].reverse().map((v) => (
                  <span key={v} className="leading-none">
                    {tab === "amount" ? formatAmount(v) : v}
                  </span>
                ))}
              </div>

              <div className="flex-1 min-w-0">
                <div className="relative h-64 border-l border-b border-[#d6e4d3]">
                  {yTicks.slice(1).map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-dashed border-[#eaf2e8]"
                      style={{ bottom: `${((i + 1) / 4) * 100}%` }}
                    />
                  ))}

                  <div className="absolute inset-0 flex items-stretch gap-px px-1">
                    {dailyData.map((d) => {
                      const paidH = yMax === 0 ? 0 : (d.paidAmount / yMax) * 100;
                      const loggedInH = yMax === 0 ? 0 : (d.loggedInPaidCount / yMax) * 100;
                      const guestH = yMax === 0 ? 0 : (d.guestPaidCount / yMax) * 100;
                      const countFreeH = yMax === 0 ? 0 : (d.freeCount / yMax) * 100;
                      const title =
                        tab === "amount"
                          ? `${d.day}\n결제금액 ${d.paidAmount.toLocaleString()}원`
                          : `${d.day}\n로그인+유료 ${d.loggedInPaidCount}건 / 비로그인+유료 ${d.guestPaidCount}건 / 무료 ${d.freeCount}건`;
                      return (
                        <div
                          key={d.day}
                          className="flex-1 flex flex-col justify-end items-center min-w-0 group"
                          title={title}
                        >
                          {tab === "amount" ? (
                            <div
                              className="w-full bg-[#365927] hover:bg-[#4a7a38] rounded-t-sm transition-colors"
                              style={{ height: `${paidH}%` }}
                            />
                          ) : (
                            <div className="w-full flex flex-row items-end gap-px h-full">
                              <div
                                className="flex-1 bg-[#365927] hover:bg-[#4a7a38] rounded-t-sm transition-colors"
                                style={{ height: `${loggedInH}%` }}
                              />
                              <div
                                className="flex-1 bg-amber-400 hover:bg-amber-500 rounded-t-sm transition-colors"
                                style={{ height: `${guestH}%` }}
                              />
                              <div
                                className="flex-1 bg-[#c8d8be] hover:bg-[#b5cba8] rounded-t-sm transition-colors"
                                style={{ height: `${countFreeH}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-px px-1 mt-2">
                  {dailyData.map((d, idx) => (
                    <div
                      key={d.day}
                      className="flex-1 text-center text-[10px] text-[#8aab82] min-w-0 truncate"
                    >
                      {showXLabel(idx, dailyData.length) ? d.day.slice(5) : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
