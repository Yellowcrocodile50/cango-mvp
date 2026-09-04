"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { FileText, Download, Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isFreeCategory } from "@/data/categories";
import { departments } from "@/data/careerDepartments";
import { colorForId } from "@/lib/coverColor";
import { trackEvent } from "@/lib/ga";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

interface OrderRow {
  id: string;
  order_id: string | null;
  amount: number;
  payment_status: string;
  payment_method: string;
  is_sent: boolean;
  created_at: string;
  materials: {
    id: string;
    title: string;
    category: string;
    thumbnail_url: string | null;
  } | null;
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
  /* 진로 탐구에서 찜한 학과. 계열·관심사와 무관한 계정 단위 목록이라 여기서도 같은 걸 본다. */
  const [wishes, setWishes] = useState<string[]>([]);
  const [wishPending, setWishPending] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketingAgreed, setMarketingAgreed] = useState<boolean | null>(null);
  const [marketingSaving, setMarketingSaving] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const paidOrders = useMemo(
    () => orders.filter((o) => !isFreeCategory(o.materials?.category ?? "")),
    [orders]
  );
  const freeOrders = useMemo(
    () => orders.filter((o) => isFreeCategory(o.materials?.category ?? "")),
    [orders]
  );

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
          "id, order_id, amount, payment_status, payment_method, is_sent, created_at, materials(id, title, category, thumbnail_url)"
        )
        .eq("buyer_id", authUser.id)
        .or("payment_status.eq.done,and(payment_status.eq.pending,payment_method.eq.bank_transfer)")
        .order("created_at", { ascending: false });

      setOrders((data as unknown as OrderRow[]) || []);

      const { data: profile } = await supabase
        .from("profiles")
        .select("marketing_agreed")
        .eq("id", authUser.id)
        .single();
      setMarketingAgreed(profile?.marketing_agreed ?? false);

      /* 본인 행만 읽힌다(RLS: users can view their own requests).
         department가 null인 행은 내신 계산기 자유 문의라 찜이 아니다. */
      const { data: wishRows } = await supabase
        .from("naeshin_requests")
        .select("department")
        .eq("user_id", authUser.id)
        .not("department", "is", null)
        .order("created_at", { ascending: false });
      setWishes((wishRows ?? []).map((r) => r.department as string));

      setLoading(false);
    })();
  }, [router]);

  const handleMarketingToggle = async () => {
    if (!user || marketingAgreed === null || marketingSaving) return;
    const next = !marketingAgreed;
    setMarketingSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ marketing_agreed: next, marketing_agreed_at: new Date().toISOString() })
      .eq("id", user.id);
    setMarketingSaving(false);
    if (error) {
      toast.error("변경에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setMarketingAgreed(next);
    toast.success(next ? "마케팅 정보 수신에 동의했어요." : "마케팅 정보 수신을 해지했어요.");
  };

  const handleWishRemove = async (department: string) => {
    if (!user || wishPending) return;
    setWishPending(department);
    const { error } = await supabase
      .from("naeshin_requests")
      .delete()
      .eq("user_id", user.id)
      .eq("department", department);
    setWishPending(null);
    if (error) {
      toast.error("찜 해제에 실패했어요. 잠시 후 다시 시도해주세요.");
      return;
    }
    setWishes((prev) => prev.filter((d) => d !== department));
    /* 진로 탐구에서만 계측하면 add − remove 순증이 실제보다 많게 나온다 —
       해제하기 제일 쉬운 자리가 여기라 누락이 작지 않다. `from`으로 어디서 뺐는지 남긴다. */
    trackEvent("career_wish_remove", { department, from: "mypage" });
  };

  const handleDownload = async (materialId: string, title: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/download/${materialId}`, {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      if (!res.ok) {
        toast.error("다운로드 링크 생성에 실패했습니다.");
        return;
      }
      const { signedUrl } = await res.json();
      const fileRes = await fetch(signedUrl);
      if (!fileRes.ok) {
        toast.error("파일을 가져오지 못했습니다.");
        return;
      }
      const blob = await fileRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("다운로드 중 오류가 발생했습니다.");
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawPassword) {
      toast.error("비밀번호를 입력해주세요.");
      return;
    }
    setWithdrawing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/account/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ password: withdrawPassword }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "탈퇴 처리 중 오류가 발생했습니다.");
        setWithdrawing(false);
        return;
      }
      await supabase.auth.signOut();
      toast.success("탈퇴가 완료되었습니다.");
      router.replace("/");
    } catch {
      toast.error("탈퇴 처리 중 오류가 발생했습니다.");
      setWithdrawing(false);
    }
  };

  const renderOrderItem = (order: OrderRow, isFree: boolean) => {
    const m = order.materials;
    const deleted = !m;
    const bg = colorForId(order.id);
    return (
      <li
        key={order.id}
        className="flex items-center gap-4 bg-white border border-[#d6e4d3] rounded-xl p-4"
      >
        {m?.thumbnail_url ? (
          <Image
            src={m.thumbnail_url}
            alt={m.title}
            width={80}
            height={96}
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
            <p className="text-sm font-medium text-[#5a7d50] truncate">삭제된 자료</p>
          ) : (
            <>
              <Link
                href={`/product/${m.id}`}
                className="text-base font-medium text-[#1a2e16] hover:text-[#365927] transition truncate block"
              >
                {m.title}
              </Link>
              <p className="text-xs text-[#5a7d50] mt-0.5">{m.category}</p>
            </>
          )}
          <p className="text-sm font-bold text-[#365927] mt-1">
            {isFree ? "무료" : `${order.amount.toLocaleString()}원`}
          </p>
          <p className="text-xs text-[#8aab82] mt-1">
            {new Date(order.created_at).toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            {isFree ? "다운로드" : "구매"}
          </p>
        </div>

        <div className="flex-shrink-0">
          {isFree ? (
            <button
              onClick={() => m && handleDownload(m.id, m.title)}
              disabled={!m}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#365927] px-3 py-1.5 rounded-md hover:bg-[#4a7a38] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              다운로드
            </button>
          ) : order.payment_method === "bank_transfer" && order.payment_status === "pending" ? (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                입금 확인 중
              </span>
              {order.order_id && (
                <Link
                  href={`/checkout/bank-pending?orderId=${order.order_id}&amount=${order.amount}`}
                  className="text-xs text-[#8aab82] hover:text-[#365927] underline underline-offset-2"
                >
                  입금 안내 다시 보기
                </Link>
              )}
            </div>
          ) : order.payment_method === "bank_transfer" && order.payment_status === "done" && !order.is_sent ? (
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-xs font-medium text-[#365927] bg-[#eaf2e8] px-2.5 py-1 rounded-md">
                ✓ 입금 확인됨
              </span>
              <span className="text-xs text-[#8aab82] bg-[#f5f9f4] px-2.5 py-1 rounded-md">
                이메일 발송 예정
              </span>
            </div>
          ) : order.is_sent ? (
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
  };

  const meta = user?.user_metadata;
  const typeLabel = userTypeLabel(meta?.user_type);
  const grade = meta?.grade as string | undefined;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

      {/* 프로필 요약 */}
      {!loading && user && (
        <div className="flex items-center gap-4 bg-white border border-[#d6e4d3] rounded-xl p-5 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#eaf2e8] flex items-center justify-center text-[#365927] font-bold text-lg flex-shrink-0">
            {(meta?.userid as string | undefined)?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#1a2e16] text-base truncate">
              {meta?.userid ?? user.email}
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
        <h1 className="text-2xl font-bold text-[#365927]">마이페이지</h1>
        <p className="text-sm text-[#5a7d50] mt-1">
          {loading ? "로딩 중..." : `총 ${orders.length}건`}
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
        <div className="space-y-8">
          {paidOrders.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#5a7d50] mb-3 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#365927]" />
                유료 자료 · {paidOrders.length}건
              </h2>
              <ul className="space-y-3">
                {paidOrders.map((o) => renderOrderItem(o, false))}
              </ul>
            </div>
          )}
          {freeOrders.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#5a7d50] mb-3 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#8aab82]" />
                무료 자료 · {freeOrders.length}건
              </h2>
              <ul className="space-y-3">
                {freeOrders.map((o) => renderOrderItem(o, true))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 찜한 학과 — 진로 탐구에서 담은 목록을 여기서도 본다.
          색은 진로 탐구의 찜과 같은 로즈 톤으로 맞춘다. 사이트 초록과 섞이면
          "내가 담은 것"이라는 성격이 안 읽힌다(CareerClient의 WISH_* 상수와 같은 값). */}
      {!loading && user && (
        <div className="mt-12 pt-6 border-t border-[#d6e4d3]">
          <h2 className="text-sm font-semibold text-[#5a7d50] mb-3 flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 shrink-0 fill-current text-[#c2415f]" aria-hidden />
            {/* 어느 도구에서 담은 건지 밝힌다 — 마이페이지만 보고 온 사람은
                "찜한 학과"만으로는 이게 어디서 생긴 목록인지 알 수 없다. */}
            <span className="text-[#8aab82]">진로 탐구</span>
            <span className="text-[#c9d9c5]" aria-hidden>·</span>
            찜한 학과
            {wishes.length > 0 && (
              <span className="font-normal text-[#8aab82]">{wishes.length}개</span>
            )}
          </h2>

          {wishes.length === 0 ? (
            /* 찜이 없는 사람에게는 이게 진로 탐구로 가는 안내가 된다 */
            <div className="rounded-xl border border-[#d6e4d3] bg-white px-4 py-4">
              <p className="text-sm text-[#5a7d50] break-keep">
                진로 탐구에서 관심 있는 학과를 찜해두면 여기에 모여요.
              </p>
              <Link
                href="/career"
                className="inline-block mt-3 px-4 py-2 rounded-lg bg-[#365927] text-white text-sm font-medium hover:bg-[#4a7a38] transition"
              >
                진로 탐구 해보기 →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {wishes.map((name) => {
                /* 찜할 땐 계산기에 없던 학과라도, 데이터가 채워지면 여기가 저절로 링크로 바뀐다 */
                const naeshinDept = departments.find((d) => d.name === name)?.naeshinDept;
                const busy = wishPending === name;

                return (
                  <li
                    key={name}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-[#f0cdd9] bg-[#fdf2f6] px-4 py-3"
                  >
                    <span className="flex-1 min-w-0 text-sm font-medium text-[#8a4159] break-keep">
                      {name}
                    </span>

                    {naeshinDept ? (
                      <Link
                        href={`/naeshin?department=${encodeURIComponent(naeshinDept)}`}
                        className="inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-full bg-[#365927] text-white text-xs font-bold hover:bg-[#4a7a38] transition"
                      >
                        등급컷 보러 가기 →
                      </Link>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleWishRemove(name)}
                      disabled={busy}
                      className="inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-full border border-[#f0cdd9] bg-white text-xs font-medium text-[#b03a5b] hover:border-[#c2415f] disabled:opacity-60 transition cursor-pointer"
                    >
                      {busy ? "해제하는 중..." : "찜 해제"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!loading && user && (
        <div className="mt-12 pt-6 border-t border-[#d6e4d3]">
          <h2 className="text-sm font-semibold text-[#5a7d50] mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#8aab82]" />
            계정 관리
          </h2>

          {/* 마케팅 수신 동의 — 가입 때 받기만 하고 사이트 안에 철회 수단이 없었다.
              광고성 정보를 보내려면 수신 거부 방법을 제공해야 한다. */}
          <div className="mb-5 rounded-lg border border-[#d6e4d3] bg-white px-4 py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#365927]">마케팅 정보 수신</p>
              <p className="mt-0.5 text-xs text-[#8aab82] leading-relaxed">
                새 자료·이벤트 소식을 이메일로 받아보실 수 있어요. 언제든 바꿀 수 있고,
                주문·결제 같은 필수 안내는 이 설정과 무관하게 발송돼요.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={marketingAgreed === true}
              aria-label="마케팅 정보 수신 동의"
              disabled={marketingAgreed === null || marketingSaving}
              onClick={handleMarketingToggle}
              className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${
                marketingAgreed ? "bg-[#365927]" : "bg-[#d6e4d3]"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  marketingAgreed ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setWithdrawPassword("");
              setWithdrawOpen(true);
            }}
            className="text-sm text-[#8aab82] hover:text-red-600 underline underline-offset-4 decoration-[#d6e4d3] hover:decoration-red-400 transition"
          >
            회원 탈퇴
          </button>
        </div>
      )}

      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl border border-[#d6e4d3] w-full max-w-md p-6 shadow-lg">
            <h3 className="text-lg font-bold text-[#1a2e16] mb-2">회원 탈퇴</h3>
            <div className="text-sm text-[#5a7d50] space-y-2 mb-4">
              <p>탈퇴 시 다음 내용이 처리됩니다.</p>
              <ul className="list-disc pl-5 space-y-1 text-[#5a7d50]">
                <li>로그인 정보 및 프로필이 즉시 삭제됩니다.</li>
                <li>구매 이력은 회계·세무 목적으로 익명화되어 보존됩니다.</li>
                <li>발송 대기 중인 주문이 있으면 탈퇴할 수 없습니다.</li>
              </ul>
              <p className="text-[#8aab82]">계속 진행하려면 비밀번호를 입력해주세요.</p>
            </div>
            <input
              type="password"
              value={withdrawPassword}
              onChange={(e) => setWithdrawPassword(e.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              disabled={withdrawing}
              className="w-full border border-[#d6e4d3] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#365927] disabled:bg-[#f5f9f4]"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setWithdrawOpen(false)}
                disabled={withdrawing}
                className="px-4 py-2 text-sm font-medium text-[#5a7d50] border border-[#d6e4d3] rounded-md hover:bg-[#f5f9f4] transition disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition disabled:opacity-50"
              >
                {withdrawing ? "처리 중..." : "회원 탈퇴"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
