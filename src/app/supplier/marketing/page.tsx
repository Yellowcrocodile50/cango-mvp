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

interface Profile {
  id: string;
  userid: string | null;
  email: string | null;
  user_type: string | null;
  grade: string | null;
  phone: string | null;
  marketing_agreed: boolean;
  created_at: string;
}

interface GuestContact {
  email: string;
  phone: string | null;
  marketing_agreed: boolean;
  latest_order_at: string;
}

export default function MarketingPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [guests, setGuests] = useState<GuestContact[]>([]);
  const [loading, setLoading] = useState(true);

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

    setProfiles(profilesResult.data ?? []);

    // 이메일 기준 중복 제거 (가장 최근 주문 기준, 동의 이력 있으면 동의 유지)
    const emailMap = new Map<string, GuestContact>();
    for (const o of guestOrdersResult.data ?? []) {
      if (!o.buyer_email) continue;
      const existing = emailMap.get(o.buyer_email);
      if (!existing) {
        emailMap.set(o.buyer_email, {
          email: o.buyer_email,
          phone: o.buyer_phone,
          marketing_agreed: o.marketing_agreed,
          latest_order_at: o.created_at,
        });
      } else {
        // 동의 이력 있으면 유지
        emailMap.set(o.buyer_email, {
          ...existing,
          marketing_agreed: existing.marketing_agreed || o.marketing_agreed,
        });
      }
    }
    setGuests([...emailMap.values()].sort((a, b) =>
      new Date(b.latest_order_at).getTime() - new Date(a.latest_order_at).getTime()
    ));

    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const memberAgreed = profiles.filter((p) => p.marketing_agreed).length;
  const guestAgreed = guests.filter((g) => g.marketing_agreed).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#365927]">마케팅 동의 여부</h1>

      {/* 회원 (로그인) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-base font-bold text-[#365927]">
            회원 (로그인)
          </CardTitle>
          {!loading && (
            <span className="text-xs text-[#5a7d50]">
              총 {profiles.length}명 · 동의 {memberAgreed}명 / 미동의 {profiles.length - memberAgreed}명
            </span>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">로딩 중...</p>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">가입한 회원이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>아이디</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>구분 / 학년</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead>마케팅 동의</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p) => (
                  <TableRow
                    key={p.id}
                    className={
                      p.marketing_agreed
                        ? "bg-green-50 hover:bg-green-100"
                        : "bg-red-50 hover:bg-red-100"
                    }
                  >
                    <TableCell className="font-medium">{p.userid || "-"}</TableCell>
                    <TableCell>{p.email || "-"}</TableCell>
                    <TableCell>
                      {p.user_type ? (
                        <span>
                          {p.user_type === "student" ? "학생" : "학부모"}
                          {p.grade && (
                            <span className="ml-1 text-muted-foreground">· {p.grade}</span>
                          )}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>{p.phone || "-"}</TableCell>
                    <TableCell>
                      {new Date(p.created_at).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell>
                      {p.marketing_agreed ? (
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

      {/* 비로그인 구매자 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
          <CardTitle className="text-base font-bold text-[#365927]">
            비로그인 구매자
          </CardTitle>
          {!loading && (
            <span className="text-xs text-[#5a7d50]">
              총 {guests.length}명 · 동의 {guestAgreed}명 / 미동의 {guests.length - guestAgreed}명
            </span>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">로딩 중...</p>
          ) : guests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">비로그인 구매 내역이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이메일</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>최근 구매일</TableHead>
                  <TableHead>마케팅 동의</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guests.map((g) => (
                  <TableRow
                    key={g.email}
                    className={
                      g.marketing_agreed
                        ? "bg-green-50 hover:bg-green-100"
                        : "bg-red-50 hover:bg-red-100"
                    }
                  >
                    <TableCell className="font-medium">{g.email}</TableCell>
                    <TableCell>{g.phone || "-"}</TableCell>
                    <TableCell>
                      {new Date(g.latest_order_at).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell>
                      {g.marketing_agreed ? (
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
