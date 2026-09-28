"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZES = [50, 100, 200] as const;

/* 목록을 화면에서 페이지로 나눈다. 정렬·필터·집계는 전체 목록 기준이어야 하므로
   서버가 아니라 여기서 자른다. 필터·정렬을 바꾸면 호출하는 쪽에서 reset()을 부를 것. */
export function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  // 새로고침·필터로 건수가 줄어도 빈 페이지에 머물지 않게
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  return {
    pageItems,
    reset: () => setPage(1),
    props: {
      total: items.length,
      start,
      pageSize,
      currentPage,
      totalPages,
      onPage: (p: number) => {
        setPage(Math.min(Math.max(1, p), totalPages));
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
      onPageSize: (s: number) => {
        setPageSize(s);
        setPage(1);
      },
    },
  };
}

interface Props {
  total: number;
  start: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}

export function TablePagination({ total, start, pageSize, currentPage, totalPages, onPage, onPageSize }: Props) {
  // 현재 페이지 주변 번호만 보여준다: 1 … 4 5 [6] 7 8 … 37
  const pageNumbers = useMemo(() => {
    const nums = new Set([1, totalPages]);
    for (let p = currentPage - 2; p <= currentPage + 2; p++) {
      if (p >= 1 && p <= totalPages) nums.add(p);
    }
    const sorted = [...nums].sort((a, b) => a - b);
    const out: (number | "gap")[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
      out.push(p);
    });
    return out;
  }, [currentPage, totalPages]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm">
      <span className="text-muted-foreground">
        전체 {total.toLocaleString()}건 중{" "}
        {(start + 1).toLocaleString()}–{Math.min(start + pageSize, total).toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => onPage(currentPage - 1)} aria-label="이전 페이지">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageNumbers.map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground">…</span>
          ) : (
            <Button
              key={p}
              size="sm"
              variant={p === currentPage ? "default" : "outline"}
              onClick={() => onPage(p)}
              className={p === currentPage ? "bg-[#365927] hover:bg-[#4a7a38] min-w-8" : "min-w-8"}
              aria-current={p === currentPage ? "page" : undefined}
            >
              {p}
            </Button>
          )
        )}
        <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => onPage(currentPage + 1)} aria-label="다음 페이지">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <label className="flex items-center gap-2 text-muted-foreground">
        페이지당
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="border rounded-md px-2 py-1 text-sm bg-white"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s}건</option>
          ))}
        </select>
      </label>
    </div>
  );
}
