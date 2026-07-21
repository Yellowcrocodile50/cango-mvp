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

// 회원가입 학년 옵션과 동일하게 유지 (src/app/signup/page.tsx)
const GRADES = ["고3/N수", "고2", "고1", "중3", "중2", "중1"];

type Kind = "member" | "guest";

interface AccountRow {
  kind: Kind;
  key: string;
  userid: string | null;
  email: string | null;
  userType: string | null;
  grade: string | null;
  phone: string | null;
  marketing_agreed: boolean;
  /** 회원=가입일, 비로그인=최근 구매일 */
  date: string;
}

type KindFilter = "all" | Kind;
type SortDir = "asc" | "desc";

export default function AccountsPage() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [agreedOnly, setAgreedOnly] = useState(false);
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchData = useCallback(async () => {
    const [profilesResult, guestOrdersResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, userid, email, user_type, grade, phone, marketing_agreed, created_at")
        .eq("role", "buyer")
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("buyer_email, buyer_phone, marketing_agreed, created_at")
        .is("buyer_id", null)
        .order("created_at", { ascending: false }),
    ]);

    const members: AccountRow[] = (profilesResult.data ?? []).map((p) => ({
      kind: "member",
      key: `m-${p.id}`,
      userid: p.userid,
      email: p.email,
      userType: p.user_type,
      grade: p.grade,
      phone: p.phone,
      marketing_agreed: p.marketing_agreed,
      date: p.created_at,
    }));

    // 비로그인 구매자: 이메일 기준 중복 제거(가장 최근 주문, 동의 이력 있으면 동의 유지)
    const emailMap = new Map<string, AccountRow>();
    for (const o of guestOrdersResult.data ?? []) {
      if (!o.buyer_email) continue;
      const existing = emailMap.get(o.buyer_email);
      if (!existing) {
        emailMap.set(o.buyer_email, {
          kind: "guest",
          key: `g-${o.buyer_email}`,
          userid: null,
          email: o.buyer_email,
          userType: null,
          grade: null,
          phone: o.buyer_phone,
          marketing_agreed: o.marketing_agreed,
          date: o.created_at,
        });
      } else {
        existing.marketing_agreed = existing.marketing_agreed || o.marketing_agreed;
      }
    }

    setRows([...members, ...emailMap.values()]);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const memberCount = useMemo(() => rows.filter((r) => r.kind === "member").length, [rows]);
  const guestCount = useMemo(() => rows.filter((r) => r.kind === "guest").length, [rows]);
  const totalAgreedCount = useMemo(
    () => rows.filter((r) => r.marketing_agreed).length,
    [rows],
  );

  const visibleRows = useMemo(() => {
    let arr = rows.slice();
    if (kindFilter !== "all") arr = arr.filter((r) => r.kind === kindFilter);
    if (agreedOnly) arr = arr.filter((r) => r.marketing_agreed);
    if (gradeFilter !== "all") arr = arr.filter((r) => r.grade === gradeFilter);
    arr.sort((a, b) => {
      const cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, kindFilter, agreedOnly, gradeFilter, sortDir]);

  // 학년 필터는 비로그인 구매자에겐 학년 정보가 없어 의미가 없음
  const gradeDisabled = kindFilter === "guest";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#365927]">계정 관리</h1>

      <Card>
        <CardHeader className="flex flex-col gap-3 pb-3 border-b">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <CardTitle className="text-base font-bold text-[#365927]">전체 계정</CardTitle>
            {!loading && (
              <span className="text-xs text-[#5a7d50]">
                로그인 {memberCount}명 / 비로그인 {guestCount}명 / 총 {memberCount + guestCount}명 (동의 {totalAgreedCount}명)
              </span>
            )}
          </div>

          {/* 필터 / 정렬 */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 구분 */}
            <div className="inline-flex rounded-md border border-[#d6e4d3] overflow-hidden">
              {([
                { v: "all", label: "전체" },
                { v: "member", label: "회원(로그인)" },
                { v: "guest", label: "비로그인" },
              ] as const).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setKindFilter(opt.v)}
                  className={`px-3 py-1.5 text-xs font-medium transition ${
                    kindFilter === opt.v
                      ? "bg-[#365927] text-white"
                      : "bg-white text-[#5a7d50] hover:bg-[#eef5ec]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* 마케팅 동의만 보기 */}
            <button
              onClick={() => setAgreedOnly((v) => !v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                agreedOnly
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-[#5a7d50] border-[#d6e4d3] hover:bg-[#eef5ec]"
              }`}
            >
              마케팅 동의만 {agreedOnly ? "✓" : ""}
            </button>

            {/* 학년 필터 */}
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              disabled={gradeDisabled}
              className="h-8 px-2 rounded-md border border-[#d6e4d3] bg-white text-xs text-[#5a7d50] focus:outline-none focus:ring-2 focus:ring-[#365927] disabled:opacity-50"
            >
              <option value="all">학년 전체</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>

            {/* 날짜 정렬 */}
            <button
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-[#d6e4d3] bg-white text-[#5a7d50] hover:bg-[#eef5ec] transition"
            >
              가입/구매 시기순 {sortDir === "desc" ? "최신순 ▼" : "오래된순 ▲"}
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">로딩 중...</p>
          ) : visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              조건에 맞는 계정이 없습니다.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>구분</TableHead>
                  <TableHead>아이디</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>구분 / 학년</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead>최근 구매일</TableHead>
                  <TableHead>마케팅 동의</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((r) => (
                  <TableRow
                    key={r.key}
                    className={
                      r.marketing_agreed
                        ? "bg-green-50 hover:bg-green-100"
                        : "bg-red-50 hover:bg-red-100"
                    }
                  >
                    <TableCell>
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-md ${
                          r.kind === "member"
                            ? "text-[#365927] bg-[#eaf2e8]"
                            : "text-[#8a6d1f] bg-[#fff8e6]"
                        }`}
                      >
                        {r.kind === "member" ? "회원" : "비로그인"}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{r.userid || "-"}</TableCell>
                    <TableCell>{r.email || "-"}</TableCell>
                    <TableCell>
                      {r.userType ? (
                        <span>
                          {r.userType === "student" ? "학생" : "학부모"}
                          {r.grade && (
                            <span className="ml-1 text-muted-foreground">· {r.grade}</span>
                          )}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{r.phone || "-"}</TableCell>
                    <TableCell>
                      {r.kind === "member" ? new Date(r.date).toLocaleDateString("ko-KR") : "-"}
                    </TableCell>
                    <TableCell>
                      {r.kind === "guest" ? new Date(r.date).toLocaleDateString("ko-KR") : "-"}
                    </TableCell>
                    <TableCell>
                      {r.marketing_agreed ? (
                        <span className="inline-block text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-md">
                          동의
                        </span>
                      ) : (
                        <span className="inline-block text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-md">
                          미동의
                        </span>
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
