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

interface NaeshinRequest {
  id: string;
  content: string;
  created_at: string;
  user_id: string | null;
  profile: {
    userid: string | null;
    email: string | null;
    user_type: string | null;
    grade: string | null;
    phone: string | null;
    marketing_agreed: boolean | null;
    marketing_agreed_at: string | null;
  } | null;
}

export default function NaeshinRequestsPage() {
  const [requests, setRequests] = useState<NaeshinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: requestRows } = await supabase
      .from("naeshin_requests")
      .select("id, content, created_at, user_id")
      .order("created_at", { ascending: false });

    const userIds = [...new Set((requestRows ?? []).map((r) => r.user_id).filter(Boolean))] as string[];

    let profileMap = new Map<string, NaeshinRequest["profile"]>();
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, userid, email, user_type, grade, phone, marketing_agreed, marketing_agreed_at")
        .in("id", userIds);
      profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]));
    }

    setRequests(
      (requestRows ?? []).map((r) => ({
        ...r,
        profile: r.user_id ? profileMap.get(r.user_id) ?? null : null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#365927]">내신 계산기 추가 문의</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-base font-bold text-[#365927]">문의 목록</CardTitle>
          {!loading && <span className="text-xs text-[#5a7d50]">총 {requests.length}건</span>}
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">로딩 중...</p>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">아직 접수된 문의가 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>아이디</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>구분 / 학년</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>마케팅 동의</TableHead>
                  <TableHead>문의 내용</TableHead>
                  <TableHead>문의일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow
                    key={r.id}
                    className={
                      !r.profile
                        ? undefined
                        : r.profile.marketing_agreed
                          ? "bg-green-50 hover:bg-green-100"
                          : "bg-red-50 hover:bg-red-100"
                    }
                  >
                    <TableCell className="font-medium">{r.profile?.userid || "-"}</TableCell>
                    <TableCell>{r.profile?.email || "-"}</TableCell>
                    <TableCell>
                      {r.profile?.user_type ? (
                        <span>
                          {r.profile.user_type === "student" ? "학생" : "학부모"}
                          {r.profile.grade && (
                            <span className="ml-1 text-muted-foreground">· {r.profile.grade}</span>
                          )}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{r.profile?.phone || "-"}</TableCell>
                    <TableCell>
                      {!r.profile ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`inline-block w-fit text-xs font-medium px-2 py-1 rounded-md ${
                              r.profile.marketing_agreed
                                ? "text-green-700 bg-green-100"
                                : "text-red-600 bg-red-100"
                            }`}
                          >
                            {r.profile.marketing_agreed ? "동의" : "미동의"}
                          </span>
                          {/* 본인이 마이페이지에서 바꾼 경우에만 값이 있다(가입 이후 미변경이면 null) */}
                          {r.profile.marketing_agreed_at && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(r.profile.marketing_agreed_at).toLocaleDateString("ko-KR")} 변경
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md whitespace-pre-wrap break-words">{r.content}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("ko-KR")}
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
