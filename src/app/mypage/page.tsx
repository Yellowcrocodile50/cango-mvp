"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface OrderRow {
  id: string;
  amount: number;
  payment_status: string;
  is_sent: boolean;
  created_at: string;
  materials: {
    id: string;
    title: string;
    category: string;
    thumbnail_url: string | null;
  } | null;
}

const coverColors = [
  "#365927",
  "#4a7a38",
  "#2d4a22",
  "#5a8c4a",
  "#3d6b2e",
  "#6b9e5a",
  "#2a5020",
  "#4d7040",
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return coverColors[Math.abs(hash) % coverColors.length];
}

function userTypeLabel(type: string | undefined): string {
  if (type === "student") return "학생";
  if (type === "parent") return "학부모";
  return "";
}

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.replace("/login?redirect=/mypage");
        return;
      }

      if (authUser.user_metadata?.role === "supplier") {
        router.replace("/supplier");
        return;
      }

      setUser(authUser);

      const { data } = await supabase
        .from("orders")
        .select(
          "id, amount, payment_status, is_sent, created_at, materials(id, title, category, thumbnail_url)"
        )
        .eq("buyer_id", user.id)
        .eq("payment_status", "done")
        .order("created_at", { ascending: false });

      setOrders((data as unknown as OrderRow[]) || []);
      setLoading(false);
    })();
  }, [router]);

  const meta = user?.user_metadata;
  const typeLabel = userTypeLabel(meta?.user_type);
  const grade = meta?.grade as string | undefined;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

      {/* 프로필 요약 */}
      {!loading && user && (
        <div className="flex items-center gap-4 bg-white border border-[#d6e4d3] rounded-xl p-5 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#eaf2e8] flex items-center justify-center text-[#365927] font-bold text-lg flex-shrink-0">
            {(meta?.username as string | undefined)?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#1a2e16] text-base truncate">
              {meta?.username ?? user.email}
            </p>
            {typeLabel && (
              <p className="text-sm text-[#5a7d50] mt-0.5">
                {typeLabel}
                {grade && <span className="ml-1.5 text-[#8aab82]">· {grade}</span>}
              </p>
            )}
            {!typeLabel && (
              <p className="text-sm text-[#8aab82] mt-0.5">{user.email}</p>
            )}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#365927]">구매 내역</h1>
        <p className="text-sm text-[#5a7d50] mt-1">
          {loading ? "로딩 중..." : `총 ${orders.length}건의 구매`}
        </p>
      </div>

      {!loading && orders.length === 0 && (
        <div className="border border-[#d6e4d3] rounded-2xl py-20 text-center bg-white">
          <FileText className="h-10 w-10 mx-auto text-[#8aab82] mb-3" />
          <p className="text-[#5a7d50] mb-4">아직 구매한 자료가 없습니다.</p>
          <Link
            href="/"
            className="inline-block px-5 py-2 bg-[#365927] text-white rounded-lg text-sm font-medium hover:bg-[#4a7a38] transition"
          >
            자료 둘러보기
          </Link>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <ul className="space-y-3">
          {orders.map((order) => {
            const m = order.materials;
            const deleted = !m;
            const bg = colorForId(order.id);
            return (
              <li
                key={order.id}
                className="flex items-center gap-4 bg-white border border-[#d6e4d3] rounded-xl p-4"
              >
                {m?.thumbnail_url ? (
                  <img
                    src={m.thumbnail_url}
                    alt={m.title}
                    className="w-20 h-24 rounded object-cover flex-shrink-0 border border-[#d6e4d3]"
                  />
                ) : (
                  <div
                    className="w-20 h-24 rounded flex-shrink-0 flex items-center justify-center text-white font-bold text-xs p-2 text-center leading-tight"
                    style={{ background: bg }}
                  >
                    {deleted ? "삭제됨" : m?.title}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {deleted ? (
                    <p className="text-sm font-medium text-[#5a7d50] truncate">
                      삭제된 자료
                    </p>
                  ) : (
                    <>
                      <Link
                        href={`/product/${m.id}`}
                        className="text-base font-medium text-[#1a2e16] hover:text-[#365927] transition truncate block"
                      >
                        {m.title}
                      </Link>
                      <p className="text-xs text-[#5a7d50] mt-0.5">
                        {m.category}
                      </p>
                    </>
                  )}
                  <p className="text-sm font-bold text-[#365927] mt-1">
                    {order.amount.toLocaleString()}원
                  </p>
                  <p className="text-xs text-[#8aab82] mt-1">
                    {new Date(order.created_at).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    구매
                  </p>
                </div>

                <div className="flex-shrink-0">
                  {order.is_sent ? (
                    <span className="text-xs font-medium text-[#365927] bg-[#eaf2e8] px-2.5 py-1 rounded-md">
                      이메일 발송 완료
                    </span>
                  ) : (
                    <span className="text-xs text-[#8aab82] bg-[#f5f9f4] px-2.5 py-1 rounded-md">
                      이메일 발송 예정
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
