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

/* 수시 원서 접수 시즌 종료일. 이 시각이 지나면 홈 배너 두 번째 자리가
   지원 전략(/aiming) → 진로 탐구(/career)로 자동으로 되돌아간다.

   📌 렌더 함수 안이 아니라 모듈 스코프에서 한 번만 잰다. 렌더 중 Date.now()를 부르면
   같은 렌더가 매번 다른 값을 볼 수 있어 React가 불순 함수 호출로 막는다(lint 실측).

   ⚠️ 수시 원서 접수가 9월 11일까지라 12일 0시(KST)에 내려간다. 마감 당일까지는 떠 있어야
   해서 11일이 아니라 12일 0시로 잡았다. */
const AIMING_SEASON_END = new Date("2026-09-12T00:00:00+09:00").getTime();
const inAimingSeason = Date.now() < AIMING_SEASON_END;

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

          평소 순서는 내신 계산기가 먼저다(이벤트의 77%가 거기서 나온다). 다만 원서 접수
          기간에는 조준 테스트를 맨 위로 올린다 — 그 며칠에만 쓸모가 있는 도구라
          둘째 줄에 두면 시즌이 끝난 뒤에 발견된다.

          ⚠️ 마감이 지나면 조준 테스트가 내려가고 진로 탐구가 돌아온다. 접수가 끝났는데
          "지금 6장을 정하세요" 배너가 남아 있으면 안 되기 때문이다.
          날짜는 AIMING_SEASON_END 한 곳만 고치면 된다.

          문구는 갈아치우지 않고 누적한다(v3.5 때 정리한 원칙). */}
      {inAimingSeason && (
        <PromoBanner href="/aiming" tone="plum">
          <span className="block md:inline">
            🎯 원서 조준 테스트 <BannerPill>NEW</BannerPill>{" "}
            <b className="font-semibold">원서 접수 기간</b>
          </span>{" "}
          {/* 유형이 나오는 테스트라는 걸 배너에서 먼저 알린다.
              "전략은?"이라고 하면 계산기처럼 읽혀서, 무엇이 나오는지가 안 보인다. */}
          <span className="block md:inline">
            <b className="font-semibold">10가지 유형 중 내 원서 스타일은?</b> 1분이면 나와요{" "}
            <span className="whitespace-nowrap">→</span>
          </span>
        </PromoBanner>
      )}
      <PromoBanner href="/naeshin" tone="green">
        <span className="block md:inline">
          🎓 내신 계산기 <BannerPill>무료</BannerPill>{" "}
          <b className="font-semibold">화공·바이오·신소재·수학·물리·통계 추가!</b>
        </span>{" "}
        <span className="block md:inline">
          가고 싶은 대학, <b className="font-semibold">몇 등급이 필요할까?</b>{" "}
          <span className="whitespace-nowrap">→</span>
        </span>
      </PromoBanner>
      {!inAimingSeason && (
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
      )}
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
