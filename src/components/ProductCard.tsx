import Link from "next/link";
import type { Material } from "@/types/material";
import { colorForId } from "@/lib/coverColor";
import { getCategoryLabel, isFreeCategory } from "@/data/categories";

export default function ProductCard({ material }: { material: Material }) {
  const bgColor = colorForId(material.id);
  const isFree = isFreeCategory(material.category);

  return (
    <div>
      <Link href={`/product/${material.id}`} className="group block">
        <div className="aspect-square rounded-lg overflow-hidden mb-3 relative shadow-sm">
          {material.thumbnail_url ? (
            <img
              src={material.thumbnail_url}
              alt={material.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-white font-bold text-lg p-6 text-center leading-tight group-hover:scale-105 transition-transform duration-300"
              style={{ background: bgColor }}
            >
              {material.title}
            </div>
          )}
          {isFree && (
            <span className="absolute top-2 left-2 bg-[#365927] text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              무료
            </span>
          )}
        </div>
      </Link>
      <div className="space-y-1">
        <Link href={`/product/${material.id}`} className="group block">
          <h3 className="text-sm font-medium leading-snug line-clamp-2 text-[#1a2e16] group-hover:text-[#365927] transition">
            {material.title}
          </h3>
        </Link>
        <Link
          href={`/?category=${encodeURIComponent(material.category)}`}
          className="block"
        >
          <p className="text-xs text-[#5d7a55] hover:underline">
            {getCategoryLabel(material.category)}
          </p>
        </Link>
        <p className="text-sm font-bold text-[#365927]">
          {isFree ? "무료" : `${material.price.toLocaleString()}원`}
        </p>
      </div>
    </div>
  );
}
