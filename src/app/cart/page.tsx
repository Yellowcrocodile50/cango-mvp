"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";

const coverColors = [
  "#365927", "#4a7a38", "#2d4a22", "#5a8c4a",
  "#3d6b2e", "#6b9e5a", "#2a5020", "#4d7040",
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return coverColors[Math.abs(hash) % coverColors.length];
}

export default function CartPage() {
  const { items, removeItem, removeItems, setItemQuantity } = useCart();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login?redirect=/cart");
      } else {
        setLoading(false);
      }
    });
  }, [router]);

  // 아이템이 바뀌면 선택 상태를 전체 선택으로 초기화
  useEffect(() => {
    setSelectedIds(items.map((i) => i.id));
  }, [items]);

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    removeItems(selectedIds);
    setSelectedIds([]);
  };

  const selectedItems = items.filter((i) => selectedIds.includes(i.id));
  const selectedTotalPrice = selectedItems.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-[#5a7d50]">로딩 중...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4 text-[#365927]">장바구니가 비어있습니다</h1>
        <p className="text-[#5a7d50] mb-6">관심 있는 자료를 담아보세요.</p>
        <Link
          href="/"
          className="inline-block bg-[#365927] text-white px-6 py-3 rounded-lg hover:bg-[#4a7a38] transition"
        >
          자료 둘러보기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold mb-8 text-[#365927]">장바구니</h1>

      {/* 전체 선택 / 선택 삭제 바 */}
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4 accent-[#365927] cursor-pointer"
          />
          <span className="text-sm font-medium text-[#365927]">
            전체 선택 ({selectedIds.length}/{items.length})
          </span>
        </label>
        <button
          onClick={handleDeleteSelected}
          disabled={selectedIds.length === 0}
          className="text-sm text-[#8aab82] hover:text-red-500 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          선택 삭제
        </button>
      </div>

      {/* 상품 목록 */}
      <div className="space-y-4">
        {items.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <div
              key={item.id}
              className={`flex items-center gap-4 p-4 bg-white border rounded-lg transition ${
                isSelected
                  ? "border-[#365927]"
                  : "border-[#d6e4d3]"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(item.id)}
                className="w-4 h-4 accent-[#365927] cursor-pointer flex-shrink-0"
              />

              {item.thumbnail_url ? (
                <img
                  src={item.thumbnail_url}
                  alt={item.title}
                  className="w-16 h-20 rounded flex-shrink-0 object-cover"
                />
              ) : (
                <div
                  className="w-16 h-20 rounded flex-shrink-0 flex items-center justify-center text-white text-xs font-bold p-1 text-center"
                  style={{ background: colorForId(item.id) }}
                >
                  PDF
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate text-[#1a2e16]">{item.title}</h3>
                {item.quantity >= 2 ? (
                  <label className="flex items-center gap-2 text-sm text-[#5a7d50] mt-1">
                    <span>수량</span>
                    <select
                      value={item.quantity}
                      onChange={(e) =>
                        setItemQuantity(item.id, parseInt(e.target.value))
                      }
                      className="h-8 px-2 border border-[#d6e4d3] rounded-md text-sm text-[#1a2e16] bg-white focus:outline-none focus:ring-2 focus:ring-[#365927] focus:border-transparent cursor-pointer"
                    >
                      {Array.from({ length: item.quantity }, (_, i) => i + 1).map(
                        (n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                ) : (
                  <p className="text-sm text-[#5a7d50]">수량: {item.quantity}</p>
                )}
              </div>

              <div className="text-right flex-shrink-0">
                <p className="font-bold text-sm text-[#365927]">
                  {(item.price * item.quantity).toLocaleString()}원
                </p>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-xs text-[#8aab82] hover:text-red-500 mt-1 cursor-pointer"
                >
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 결제 영역 */}
      <div className="mt-8 border-t border-[#d6e4d3] pt-6">
        <div className="flex justify-between items-center mb-6">
          <span className="text-lg font-medium text-[#1a2e16]">
            선택 상품 금액 ({selectedIds.length}개)
          </span>
          <span className="text-2xl font-bold text-[#365927]">
            {selectedTotalPrice.toLocaleString()}원
          </span>
        </div>

        <button
          onClick={() => {
            if (selectedIds.length === 0) {
              alert("구매할 상품을 선택해주세요.");
              return;
            }
            router.push(`/checkout?ids=${encodeURIComponent(selectedIds.join(","))}`);
          }}
          disabled={selectedIds.length === 0}
          className="w-full h-14 bg-[#365927] text-white rounded-lg font-medium hover:bg-[#4a7a38] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          선택 구매하기 ({selectedIds.length}개)
        </button>
      </div>
    </div>
  );
}
