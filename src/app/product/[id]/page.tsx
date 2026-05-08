"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import type { Material } from "@/types/material";
import { getBreadcrumb, getCategoryLabel } from "@/data/categories";
import { colorForId } from "@/lib/coverColor";

export default function ProductDetail() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { addItem } = useCart();
  const [user, setUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const id = params.id as string;
    supabase
      .from("materials")
      .select("*")
      .eq("id", id)
      .eq("is_deleted", false)
      .maybeSingle()
      .then(({ data }) => {
        setMaterial(data);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-[#5a7d50]">로딩 중...</p>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4 text-[#365927]">자료를 찾을 수 없습니다</h1>
        <Link href="/" className="text-[#5a7d50] underline">
          메인으로 돌아가기
        </Link>
      </div>
    );
  }

  const bgColor = colorForId(material.id);

  const handleAddToCart = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    addItem({
      id: material.id,
      title: material.title,
      price: material.price,
      thumbnail_url: material.thumbnail_url,
    });
    alert("장바구니에 담겼습니다!");
  };

  const handleBuyNow = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    addItem({
      id: material.id,
      title: material.title,
      price: material.price,
      thumbnail_url: material.thumbnail_url,
    });
    router.push("/checkout");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm text-[#5a7d50] mb-6 flex flex-wrap items-center">
        <Link href="/" className="hover:text-[#365927]">홈</Link>
        {getBreadcrumb(material.category).map((item) => (
          <span key={item.name} className="flex items-center">
            <span className="mx-2">{">"}</span>
            <Link
              href={item.href ?? `/?category=${encodeURIComponent(item.name)}`}
              className="hover:text-[#365927]"
            >
              {item.name}
            </Link>
          </span>
        ))}
        <span className="mx-2">{">"}</span>
        <span className="text-[#365927]">{material.title}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div
          className="self-start rounded-lg overflow-hidden shadow-md bg-[#f5f9f4]"
          style={{ aspectRatio: '1/1', maxWidth: 'min(100%, calc(100vh - 160px))' }}
        >
          {material.thumbnail_url ? (
            <img
              src={material.thumbnail_url}
              alt={material.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-white font-bold text-2xl p-8 text-center leading-tight"
              style={{ background: bgColor }}
            >
              {material.title}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="text-2xl font-bold mb-2 text-[#1a2e16]">{material.title}</h1>
          {material.description && (
            <p className="text-[#5a7d50] mb-6">{material.description}</p>
          )}

          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold text-[#365927]">
              {material.price.toLocaleString()}원
            </span>
          </div>

          <div className="space-y-3 mb-6 pr-20 sm:pr-0">
            <button
              onClick={handleBuyNow}
              className="w-full h-14 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition cursor-pointer"
            >
              바로 구매하기
            </button>
            <button
              onClick={handleAddToCart}
              className="w-full h-14 border-2 border-[#365927] text-[#365927] rounded-lg font-medium hover:bg-[#eaf2e8] transition cursor-pointer"
            >
              장바구니 담기
            </button>
          </div>

          <div className="border-t border-[#d6e4d3] pt-6 space-y-3 text-sm text-[#5a7d50]">
            <div className="flex justify-between">
              <span>카테고리</span>
              <Link
                href={`/?category=${encodeURIComponent(material.category)}`}
                className="text-[#1a2e16] hover:text-[#365927] hover:underline transition"
              >
                {getCategoryLabel(material.category)}
              </Link>
            </div>
            <div className="flex justify-between">
              <span>형식</span>
              <span className="text-[#1a2e16]">PDF</span>
            </div>
          </div>
        </div>
      </div>

      {material.preview_images && material.preview_images.length > 0 && (
        <div className="mt-12 border-t border-[#d6e4d3] pt-10">
          <h2 className="text-lg font-bold text-[#1a2e16] mb-6">미리보기</h2>
          <div className="max-w-2xl mx-auto space-y-2">
            {(previewExpanded ? material.preview_images : material.preview_images.slice(0, 1)).map(
              (url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`미리보기 ${idx + 1}페이지`}
                  className="w-full rounded-lg shadow-sm"
                />
              )
            )}
          </div>
          {material.preview_images.length > 1 && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setPreviewExpanded(!previewExpanded)}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#365927] text-white rounded-full text-sm font-semibold hover:bg-[#4a7a38] shadow-md transition cursor-pointer"
              >
                {previewExpanded ? "접기 ▲" : "미리보기 더보기 ▼"}
              </button>
            </div>
          )}
        </div>
      )}

      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 text-center shadow-xl">
            <h2 className="text-2xl font-bold text-[#365927] mb-3">잠깐, 로그인은 하셨나요?</h2>
            <p className="text-[#5a7d50] text-xs mb-6">
              장바구니는 로그인 후 이용할 수 있어요.
            </p>
            <div className="space-y-3">
              <Link
                href={`/login?redirect=${encodeURIComponent(pathname)}`}
                onClick={() => setShowLoginModal(false)}
                className="block w-full h-12 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition flex items-center justify-center"
              >
                로그인하기
              </Link>
              <button
                onClick={() => { setShowLoginModal(false); router.push("/"); }}
                className="w-full h-12 border border-[#d6e4d3] text-[#5a7d50] rounded-lg font-medium hover:bg-[#f5f9f4] transition cursor-pointer"
              >
                둘러볼게요
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
