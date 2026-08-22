"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Heart } from "lucide-react";
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

interface WishRow {
  id: string;
  department: string;
  created_at: string;
  notified_at: string | null;
  user_id: string | null;
  profile: {
    userid: string | null;
    email: string | null;
    user_type: string | null;
    grade: string | null;
    phone: string | null;
    marketing_agreed: boolean | null;
  } | null;
}

export default function CareerWishesPage() {
  const [wishes, setWishes] = useState<WishRow[]>([]);
  const [loading, setLoading] = useState(true);
  /* null이면 학과 목록, 값이 있으면 그 학과의 사람 목록 — 한 페이지 안에서 두 화면을 쓴다 */
  const [selected, setSelected] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    /* department가 null인 행은 내신 계산기 자유 문의라 여기 대상이 아니다
       (그쪽은 "내신 계산기 추가 문의" 메뉴가 따로 본다). */
    const { data: wishRows } = await supabase
      .from("naeshin_requests")
      .select("id, department, created_at, notified_at, user_id")
      .not("department", "is", null)
      .order("created_at", { ascending: false });

    const userIds = [
      ...new Set((wishRows ?? []).map((r) => r.user_id).filter(Boolean)),
    ] as string[];

    let profileMap = new Map<string, WishRow["profile"]>();
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, userid, email, user_type, grade, phone, marketing_agreed")
        .in("id", userIds);
      profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]));
    }

    setWishes(
      (wishRows ?? []).map((r) => ({
        ...r,
        department: r.department as string,
        profile: r.user_id ? profileMap.get(r.user_id) ?? null : null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  /* 학과별 인원. 유니크 인덱스가 사람당 학과 1건을 보장하므로 행 수 = 사람 수다.
     많이 담긴 순으로 세워야 "다음에 어느 학과를 넣을까"가 바로 읽힌다. */
  const byDepartment = useMemo(() => {
    const map = new Map<string, { total: number; pending: number }>();
    for (const w of wishes) {
      const cur = map.get(w.department) ?? { total: 0, pending: 0 };
      cur.total += 1;
      if (!w.notified_at) cur.pending += 1;
      map.set(w.department, cur);
    }
    return [...map.entries()].sort(
      (a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0])
    );
  }, [wishes]);

  const selectedRows = useMemo(
    () => (selected ? wishes.filter((w) => w.department === selected) : []),
    [wishes, selected]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#365927]">진로 탐구 찜 문의</h1>
        <p className="text-sm text-muted-foreground py-8 text-center">로딩 중...</p>
      </div>
    );
  }

  /* ── 학과 하나를 고른 화면 ── */
  if (selected) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1 text-sm font-medium text-[#365927] hover:text-[#4a7a38] transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden />
          학과 목록으로
        </button>

        <div>
          <h1 className="text-2xl font-bold text-[#365927]">{selected}</h1>
          <p className="text-sm text-[#5a7d50] mt-1">
            찜한 사람 {selectedRows.length}명
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <CardTitle className="text-base font-bold text-[#365927]">신청자</CardTitle>
            {/* 마케팅 동의 여부를 열로 두지 않고 행 색으로 표시하므로 범례를 남긴다 */}
            <span className="text-xs text-muted-foreground">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 align-middle mr-1" />
              마케팅 동의
              <span className="inline-block w-2 h-2 rounded-full bg-red-400 align-middle ml-3 mr-1" />
              미동의
            </span>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>아이디</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>구분 / 학년</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>찜한 날짜</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedRows.map((w) => (
                  <TableRow
                    key={w.id}
                    className={
                      !w.profile
                        ? undefined
                        : w.profile.marketing_agreed
                          ? "bg-green-50 hover:bg-green-100"
                          : "bg-red-50 hover:bg-red-100"
                    }
                  >
                    <TableCell className="font-medium">{w.profile?.userid || "-"}</TableCell>
                    <TableCell>{w.profile?.email || "-"}</TableCell>
                    <TableCell>
                      {w.profile?.user_type ? (
                        <span>
                          {w.profile.user_type === "student" ? "학생" : "학부모"}
                          {w.profile.grade && (
                            <span className="ml-1 text-muted-foreground">· {w.profile.grade}</span>
                          )}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{w.profile?.phone || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(w.created_at).toLocaleDateString("ko-KR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── 학과 목록 화면 ── */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#365927]">진로 탐구 찜 문의</h1>
        <p className="text-sm text-[#5a7d50] mt-1">
          진로 탐구에서 &quot;내신 계산기에 없는 학과&quot;를 찜한 기록이에요. 학과를 누르면 신청자가 나와요.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-base font-bold text-[#365927]">학과별 찜</CardTitle>
          <span className="text-xs text-[#5a7d50]">
            학과 {byDepartment.length}개 · 총 {wishes.length}건
          </span>
        </CardHeader>
        <CardContent className="pt-4">
          {byDepartment.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              아직 찜한 학과가 없습니다.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {byDepartment.map(([dept, count]) => (
                <li key={dept}>
                  <button
                    type="button"
                    onClick={() => setSelected(dept)}
                    className="w-full flex items-center gap-2 rounded-lg border border-[#f0cdd9] bg-[#fdf2f6] px-4 py-3 text-left hover:border-[#c2415f] transition cursor-pointer"
                  >
                    <Heart className="w-4 h-4 shrink-0 fill-current text-[#c2415f]" aria-hidden />
                    <span className="flex-1 min-w-0 text-sm font-medium text-[#8a4159] break-keep">
                      {dept}
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-[#b03a5b]">
                      {count.total}명
                    </span>
                    {/* 이미 알린 건이 섞여 있으면 남은 대기 인원을 따로 보여준다 */}
                    {count.pending !== count.total && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        (대기 {count.pending})
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
