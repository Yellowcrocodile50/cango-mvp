"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import SupplierUploadSection from "@/components/SupplierUploadSection";
import PromoBanner, { BannerPill } from "@/components/PromoBanner";
import { supabase } from "@/lib/supabase";
import { categoryGroups, getBreadcrumb, isFreeCategory } from "@/data/categories";
import type { Material } from "@/types/material";

function ProductGrid() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const [supplierUserId, setSupplierUserId] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user;
        setSupplierUserId(
          user?.user_metadata?.role === "supplier" ? user.id : null
        );
      }
    );

    return () => subscription.unsubscribe();
  }, []);

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

  const group = categoryGroups.find((g) => g.label === category);
  const subGroup = !group
    ? categoryGroups.flatMap((g) => g.subGroups ?? []).find((sg) => sg.label === category)
    : undefined;

  const filtered = category
    ? materials.filter((m) => {
        if (group) return group.items.includes(m.category);
        if (subGroup) return subGroup.items.includes(m.category);
        return m.category === category;
      })
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

          문구는 갈아치우지 않고 누적한다(v3.5 때 정리한 원칙). */}
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
      <PromoBanner href="/career" tone="blue">
        <span className="block md:inline">
          🧭 진로 탐구 <BannerPill>NEW</BannerPill>{" "}
          <b className="font-semibold">학과 99개</b>
        </span>{" "}
        <span className="block md:inline">
          내가 좋아하는 건 이런 건데, <b className="font-semibold">어떤 학과에 가면 좋을까?</b>{" "}
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
                <span key={item.name}>
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
