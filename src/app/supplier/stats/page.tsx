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
}

interface DailyEntry {
  day: string;
  paidAmount: number;
  paidCount: number;
  freeCount: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function kstDateKey(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function formatAmount(n: number): string {
  if (n === 0) return "0";
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}천`;
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

export default function StatsPage() {
  const [tab, setTab] = useState<Tab>("amount");

  const today = useMemo(() => new Date(), []);
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d;
  }, []);

  const [startDate, setStartDate] = useState(isoDate(monthAgo));
  const [endDate, setEndDate] = useState(isoDate(today));
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [freeMaterialIds, setFreeMaterialIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: myMaterials } = await supabase
        .from("materials")
        .select("id, category")
        .eq("supplier_id", user.id);

      const materials = myMaterials ?? [];
      const materialIds = materials.map((m) => m.id);
      const freeSet = new Set(
        materials.filter((m) => isFreeCategory(m.category)).map((m) => m.id)
      );
      setFreeMaterialIds(freeSet);

      if (materialIds.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const startISO = new Date(`${startDate}T00:00:00+09:00`).toISOString();
      const endISO = new Date(`${endDate}T23:59:59+09:00`).toISOString();

      const { data: rawOrders } = await supabase
        .from("orders")
        .select("amount, created_at, material_id")
        .in("material_id", materialIds)
        .eq("payment_status", "done")
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      setOrders(rawOrders ?? []);
      setLoading(false);
    })();
  }, [startDate, endDate]);

  const dailyData: DailyEntry[] = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00+09:00`);
    const end = new Date(`${endDate}T00:00:00+09:00`);
    const days: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(isoDate(d));
    }

    const map = new Map<string, DailyEntry>();
    for (const day of days) {
      map.set(day, { day, paidAmount: 0, paidCount: 0, freeCount: 0 });
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
      }),
      { paidAmount: 0, paidCount: 0, freeCount: 0 }
    );
  }, [dailyData]);

  const rawMax = useMemo(() => {
    if (tab === "amount") {
      return Math.max(0, ...dailyData.map((d) => d.paidAmount));
    }
    return Math.max(0, ...dailyData.flatMap((d) => [d.paidCount, d.freeCount]));
  }, [tab, dailyData]);

  const yMax = niceMax(rawMax);
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
              max={isoDate(today)}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 px-3 border border-[#d6e4d3] rounded-md bg-white text-[#365927] focus:outline-none focus:ring-2 focus:ring-[#365927]"
            />
            <span className="ml-auto text-xs text-[#5a7d50]">
              {tab === "amount"
                ? `합계 ${totals.paidAmount.toLocaleString()}원`
                : `합계 ${totals.paidCount + totals.freeCount}건 (유료 ${totals.paidCount} / 무료 ${totals.freeCount})`}
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="flex justify-end gap-4 mb-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#365927]" />
              <span className="text-[#5a7d50]">유료</span>
            </div>
            {tab === "count" && (
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm bg-[#c8d8be]" />
                <span className="text-[#5a7d50]">무료</span>
              </div>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground py-20 text-center">로딩 중...</p>
          ) : (
            <div className="flex">
              <div className="flex flex-col justify-between h-64 pr-2 text-xs text-[#8aab82] text-right shrink-0">
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
                      const countPaidH = yMax === 0 ? 0 : (d.paidCount / yMax) * 100;
                      const countFreeH = yMax === 0 ? 0 : (d.freeCount / yMax) * 100;
                      const title =
                        tab === "amount"
                          ? `${d.day}\n결제금액 ${d.paidAmount.toLocaleString()}원`
                          : `${d.day}\n유료 ${d.paidCount}건 / 무료 ${d.freeCount}건`;
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
                                style={{ height: `${countPaidH}%` }}
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
