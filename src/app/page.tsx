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
      {/* 도구 배너 2개. 순서는 내신 계산기가 먼저 — 이벤트의 77%가 거기서 나온다.
          문구는 갈아치우지 않고 누적한다(v3.5 때 정리한 원칙). */}
      <PromoBanner href="/naeshin" tone="green">
        <span className="block md:inline">
          🎓 내신 계산기 <BannerPill>무료</BannerPill>{" "}
          <b className="font-semibold">간호·보건·건축·심리·행정 추가!</b>
        </span>{" "}
        <span className="block md:inline">
          가고 싶은 대학, <b className="font-semibold">몇 등급이 필요할까?</b>{" "}
          <span className="whitespace-nowrap">→</span>
        </span>
      </PromoBanner>
      <PromoBanner href="/career" tone="blue">
        <span className="block md:inline">
          🧭 진로 탐구 <BannerPill>새로 나왔어요</BannerPill>{" "}
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
