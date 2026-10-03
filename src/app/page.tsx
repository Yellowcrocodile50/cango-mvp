"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import dynamic from "next/dynamic";
import PromoBanner, { BannerPill } from "@/components/PromoBanner";
import { supabase } from "@/lib/supabase";
import { fetchIsSupplier } from "@/lib/supplierRole";
import { categoryMatches, getBreadcrumb, isFreeCategory } from "@/data/categories";
import SusiFilterChips from "@/components/SusiFilterChips";
import type { Material } from "@/types/material";

// 공급자만 보는 업로드 폼. 정적으로 import하면 모든 방문자의 홈 번들에 들어가므로 필요할 때만 불러온다.
// 공급자 판별이 클라이언트에서 끝난 뒤에만 그려지는 컴포넌트라 서버 HTML(SEO)에는 원래 없다.
const SupplierUploadSection = dynamic(() => import("@/components/SupplierUploadSection"), { ssr: false });

function ProductGrid() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [confirmedSupplierId, setConfirmedSupplierId] = useState<string | null>(null);
  // 공급자 판별은 profiles.role(fetchIsSupplier). 현재 로그인 사용자와 확인된 id가 같을 때만 업로드 폼을 보인다
  const supplierUserId = authUserId && confirmedSupplierId === authUserId ? authUserId : null;
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setAuthUserId(session?.user?.id ?? null)
    );

    return () => subscription.unsubscribe();
  }, []);

  // onAuthStateChange 콜백 안에서 supabase를 다시 부르면 교착될 수 있어 별도 effect에서 조회한다
  useEffect(() => {
    if (!authUserId) return;
    let cancelled = false;
    fetchIsSupplier(authUserId).then((ok) => {
      if (!cancelled) setConfirmedSupplierId(ok ? authUserId : null);
    });
    return () => { cancelled = true; };
  }, [authUserId]);

  const fetchMaterials = useCallback(() => {
    supabase
      .from("materials")
      .select("*")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .then(
        ({ data }) => {
          setMaterials(data || []);
          setLoading(false);
        },
        () => {
          setLoading(false);
        }
      );
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // 상위 카테고리를 고르면 하위(무료 수시의 학년·과목 등)까지 포함한다 — categoryMatches
  const filtered = category
    ? materials.filter((m) => categoryMatches(category, m.category))
    : materials.filter((m) => !isFreeCategory(m.category));

  return (
    <>
      {/* 도구 배너는 **항상 2개**로 유지한다. 3개가 되면 자료 카탈로그가 첫 화면 밖으로
          밀려나는데, 헤더 클릭의 61%가 자료 카테고리였다(도구는 23%) — 홈에 온 사람의
          다수는 자료를 찾으러 온 사람이다.

          🔻 2026-09-19 (사용자 지시): 내신 계산기 배너를 내리고 조준 테스트 + 진로 탐구
          2개로 고정했다. 계산기는 배너 없이도 검색에서 `/naeshin`으로 직접 떨어지는 반면,
          나머지 두 도구는 그만한 자력 유입이 없다. 배너 칸을 자력으로 못 버는 쪽에 준다.
          (판단 근거가 된 실측 수치와 철거 전 기준선은 레포 밖 운영 메모에 있다.)

          ⚠️ 기간 조건은 일부러 두지 않았다(사용자 결정). 예전엔 AIMING_SEASON_END로 수시
          접수 마감(9/12 0시)에 맞춰 조준 테스트를 자동으로 내렸는데, 그 상수는 지웠고 이제
          두 배너 다 상시다. 그래서 조준 테스트 첫 줄에서 시즌을 가리키던 "원서 접수 기간"을
          "수시 6장 전략"으로 바꿨다 — 접수가 끝난 뒤에도 접수 중인 것처럼 읽히면 안 된다.

          🚫 되돌릴 땐 날짜 상수를 되살리지 말고 이 주석부터 읽을 것. 자동 복귀는 실제로
          코드대로 동작했지만(9/12 확인), "언제 내려갔는지"를 아무도 모르는 채로 지표가
          바뀌어서 원인 분석이 한 번 꼬였다.

          문구는 갈아치우지 않고 누적한다(v3.5 때 정리한 원칙).

          🔁 2026-09-27 (사용자 지시): 진로 탐구 배너를 내리고 내신 계산기 v5.0 배너를 다시
          올렸다(조준 테스트 + 계산기 2개). 9/19에 계산기를 내린 이유(검색 자력 유입)는
          그대로지만, v5.0에 요청 많던 학과 7개가 들어와서 이미 온 사람에게 알리는 칸으로 쓴다.
          진로 탐구의 NEW 딱지도 이때 같이 뗐다. */}
      <PromoBanner href="/naeshin" tone="green">
        <span className="block md:inline">
          🎓 내신 계산기 <BannerPill>v5.0</BannerPill>{" "}
          <b className="font-semibold">경제·통상·사범대·사회복지·광고홍보 추가!</b>
        </span>{" "}
        <span className="block md:inline">
          가고 싶은 대학, <b className="font-semibold">몇 등급이 필요할까?</b>{" "}
          <span className="whitespace-nowrap">→</span>
        </span>
      </PromoBanner>
      <PromoBanner href="/aiming" tone="plum">
        <span className="block md:inline">
          🎯 원서 조준 테스트 <BannerPill>NEW</BannerPill>{" "}
          <b className="font-semibold">수시 6장 전략</b>
        </span>{" "}
        {/* 유형이 나오는 테스트라는 걸 배너에서 먼저 알린다.
            "전략은?"이라고 하면 계산기처럼 읽혀서, 무엇이 나오는지가 안 보인다. */}
        <span className="block md:inline">
          <b className="font-semibold">10가지 유형 중 내 원서 스타일은?</b> 1분이면 나와요{" "}
          <span className="whitespace-nowrap">→</span>
        </span>
      </PromoBanner>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {supplierUserId && (
        <SupplierUploadSection
          userId={supplierUserId}
          onUploaded={fetchMaterials}
        />
      )}

      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#365927]">
          {category ? (
            <>
              {getBreadcrumb(category).map((item, i) => (
                // 단계 이름 안에서는 줄을 바꾸지 않고(좁은 화면에서 "수 / 시"로 갈라지던 것), 단계 사이에서만 바꾼다.
                // inline-block이어야 단계 단위로 줄이 넘어간다 — nowrap만 주면 전체가 한 덩어리로 화면 밖으로 나간다
                <span key={item.name} className="inline-block whitespace-nowrap">
                  {i > 0 && (
                    <span className="mx-1.5 text-[#8aab82] font-normal">›</span>
                  )}
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="font-normal text-[#5a7d50] hover:text-[#365927] transition"
                    >
                      {item.name}
                    </Link>
                  ) : (
                    <span>{item.name}</span>
                  )}
                </span>
              ))}
            </>
          ) : (
            "전체 자료"
          )}
        </h2>
        <p className="text-sm text-[#5a7d50] mt-1">
          {loading ? "로딩 중..." : `${filtered.length}개의 자료`}
        </p>
        {category && <SusiFilterChips category={category} />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
        {filtered.map((material) => (
          <ProductCard key={material.id} material={material} />
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-20 text-[#8aab82]">
          <p className="mb-4">해당 카테고리에 자료가 없습니다.</p>
          <Link
            href="/"
            className="inline-block px-6 py-2.5 bg-[#365927] text-white rounded-lg text-sm font-medium hover:bg-[#4a7a38] transition"
          >
            전체 자료 보기
          </Link>
        </div>
      )}
      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-[#5a7d50]">로딩 중...</div>}>
      <ProductGrid />
    </Suspense>
  );
}
